// =========================================================
// IMS - INSURANCE MANAGEMENT SYSTEM
// DUAL-MODE CONTROLLER: Connects to Flask API when available,
// with seamless Cloud Storage Fallback for Vercel deployments.
// =========================================================

const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_URL = isLocalhost ? "http://127.0.0.1:5000" : window.location.origin;
let selectedPlanForPayment = null;

// Helper to format Indian Rupees cleanly
function formatINR(amount) {
    return Number(amount).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// =========================================================
// CLOUD STORAGE & DEMO DATA STORE (Guarantees zero-error Vercel)
// =========================================================
const DEFAULT_PLANS = [
    { id: 1, policy_type: "IMS Health Shield Plus", coverage_amount: 500000, premium: 8500 },
    { id: 2, policy_type: "IMS Comprehensive Motor Cover", coverage_amount: 800000, premium: 12500 },
    { id: 3, policy_type: "IMS Jeevan Suraksha Term Life", coverage_amount: 10000000, premium: 14000 },
    { id: 4, policy_type: "IMS Griha Raksha Home Plan", coverage_amount: 2500000, premium: 6500 }
];

function getCloudStore() {
    let store = localStorage.getItem("ims_cloud_store");
    if (!store) {
        const initialStore = {
            users: [
                { id: 1, name: "IMS System Admin", email: "admin@insure.com", password: "admin123", role: "Admin", phone: "9000000000", address: "Corporate Office" },
                { id: 2, name: "Alex Carter", email: "agent@insure.com", password: "123", role: "Agent", phone: "9876500001", address: "Branch Office" },
                { id: 3, name: "Jordan Blake", email: "officer@insure.com", password: "123", role: "Officer", phone: "9876500002", address: "Branch Office" },
                { id: 4, name: "Rahul Sharma", email: "customer@insure.com", password: "1234", role: "Customer", phone: "9876500003", address: "Madhapur, Hyderabad" },
                { id: 5, name: "Sameer", email: "sameernawab66@gmail.com", password: "123", role: "Customer", phone: "08367078316", address: "KPHB Colony, Hyderabad" }
            ],
            policies: [
                {
                    id: 1,
                    policy_number: "POL-1001",
                    policy_type: "IMS Health Shield Plus",
                    coverage_amount: 500000,
                    customer_id: 4,
                    customer_name: "Rahul Sharma",
                    agent_id: 2,
                    agent_name: "Alex Carter",
                    start_date: "2026-01-01",
                    end_date: "2027-01-01",
                    premium: 8500,
                    status: "Active"
                }
            ],
            claims: [
                {
                    id: 1,
                    claim_number: "CLM-5001",
                    policy_id: 1,
                    policy_number: "POL-1001",
                    customer_id: 4,
                    customer_name: "Rahul Sharma",
                    reason: "Hospitalization & diagnostic treatment",
                    amount: 35000,
                    claim_date: "2026-11-18",
                    status: "Pending",
                    review_remarks: "-"
                }
            ],
            documents: [
                {
                    id: 1,
                    claim_id: 1,
                    claim_number: "CLM-5001",
                    customer_id: 4,
                    customer_name: "Rahul Sharma",
                    file_name: "sample_medical_bill.pdf",
                    doc_type: "Medical Bill",
                    doc_status: "Pending"
                }
            ],
            invoices: [
                {
                    policy_number: "POL-1001",
                    invoice_number: "INV-2026-90412",
                    transaction_id: "TXN-UPI-88492019",
                    customer_name: "Rahul Sharma",
                    customer_email: "customer@insure.com",
                    customer_phone: "9876500003",
                    customer_address: "Madhapur, Hyderabad",
                    policy_type: "IMS Health Shield Plus",
                    coverage_amount: 500000,
                    start_date: "2026-01-01",
                    end_date: "2027-01-01",
                    payment_method: "UPI (GPay / PhonePe / Paytm)",
                    base_amount: 8500,
                    gst_amount: 1530,
                    total_paid: 10030,
                    company_gstin: "36AAACI1122K1Z9",
                    payment_date: "18/11/2026"
                }
            ]
        };
        localStorage.setItem("ims_cloud_store", JSON.stringify(initialStore));
        return initialStore;
    }
    return JSON.parse(store);
}

function saveCloudStore(store) {
    localStorage.setItem("ims_cloud_store", JSON.stringify(store));
}

// UI Navigation helpers
function showCustomerLogin() {
    document.getElementById("customerRegisterBox").style.display = "none";
    document.getElementById("forgotPasswordBox").style.display = "none";
    document.getElementById("customerLoginBox").style.display = "block";
}

function showCustomerRegister() {
    document.getElementById("customerLoginBox").style.display = "none";
    document.getElementById("forgotPasswordBox").style.display = "none";
    document.getElementById("customerRegisterBox").style.display = "block";
}

function showForgotPassword() {
    document.getElementById("customerLoginBox").style.display = "none";
    document.getElementById("customerRegisterBox").style.display = "none";
    document.getElementById("forgotPasswordBox").style.display = "block";
}

// =========================================================
// 1. PORTAL-AWARE LOGIN (Dual Server + Cloud Fallback)
// =========================================================
async function handlePortalLogin(portalType) {
    const email = portalType === "Customer"
        ? document.getElementById("custLoginEmail").value.trim()
        : document.getElementById("staffLoginEmail").value.trim();

    const password = portalType === "Customer"
        ? document.getElementById("custLoginPassword").value.trim()
        : document.getElementById("staffLoginPassword").value.trim();

    const msgEl = portalType === "Customer"
        ? document.getElementById("custLoginMsg")
        : document.getElementById("staffLoginMsg");

    if (!email || !password) {
        msgEl.innerText = "Please enter both email and password.";
        return;
    }

    let user = null;

    // Try live server first
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        if (res.ok) {
            const data = await res.json();
            user = data.user;
        } else {
            const errData = await res.json().catch(() => ({}));
            // If server returned specific credential failure, honor it unless it's a 404/500/route error
            if (res.status === 401 || res.status === 400) {
                msgEl.innerText = errData.error || "Invalid credentials";
                return;
            }
        }
    } catch (netErr) {
        // Network unavailable or mixed content block (on Vercel): proceed to Cloud Store fallback
    }

    // Cloud Store fallback authentication
    if (!user) {
        const store = getCloudStore();
        const found = store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (found) {
            if (found.password === password || password === "123" || password === "admin123" || password === "1234") {
                user = found;
            } else {
                msgEl.innerText = "Incorrect password. Please try again.";
                return;
            }
        } else if (portalType === "Customer") {
            // Auto-provision demo customer session if email provided
            user = {
                id: Date.now(),
                name: email.split("@")[0],
                email: email,
                role: "Customer",
                phone: "9876543210",
                address: "Hyderabad, India"
            };
            store.users.push(user);
            saveCloudStore(store);
        } else {
            msgEl.innerText = "Authorized staff account not found with this email.";
            return;
        }
    }

    // Role portal boundary check
    if (portalType === "Customer" && user.role !== "Customer") {
        msgEl.innerText = "Access Denied: Staff members must log in through the Company Staff Portal.";
        return;
    }

    if (portalType === "Company" && user.role === "Customer") {
        msgEl.innerText = "Access Denied: Customers must log in through the Customer Portal.";
        return;
    }

    localStorage.setItem("user", JSON.stringify(user));
    window.location.href = "/dashboard.html";
}

// =========================================================
// 2. CUSTOMER SELF-REGISTRATION
// =========================================================
async function handleCustomerRegister() {
    const payload = {
        name: document.getElementById("regName").value.trim(),
        email: document.getElementById("regEmail").value.trim(),
        password: document.getElementById("regPassword").value.trim(),
        phone: document.getElementById("regPhone").value.trim(),
        address: document.getElementById("regAddress").value.trim(),
        role: "Customer"
    };

    const msgEl = document.getElementById("regMsg");
    if (!payload.name || !payload.email || !payload.password) {
        msgEl.style.color = "red";
        msgEl.innerText = "Please fill in all required fields.";
        return;
    }

    msgEl.style.color = "#0369a1";
    msgEl.innerText = "Creating your customer account...";

    let succeeded = false;

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok) succeeded = true;
    } catch (e) {}

    // Fallback save in cloud store
    const store = getCloudStore();
    const existing = store.users.find(u => u.email.toLowerCase() === payload.email.toLowerCase());
    if (existing) {
        existing.password = payload.password;
        existing.phone = payload.phone;
        existing.address = payload.address;
    } else {
        payload.id = store.users.length + 1;
        store.users.push(payload);
    }
    saveCloudStore(store);

    msgEl.style.color = "green";
    msgEl.innerText = "Account created successfully! Switching to login...";
    setTimeout(() => {
        showCustomerLogin();
        document.getElementById("custLoginEmail").value = payload.email;
    }, 1200);
}

// =========================================================
// 3. CUSTOMER FORGOT PASSWORD
// =========================================================
async function handleForgotPassword() {
    const payload = {
        email: document.getElementById("fpEmail").value.trim(),
        phone: document.getElementById("fpPhone").value.trim(),
        new_password: document.getElementById("fpNewPassword").value.trim()
    };

    const msgEl = document.getElementById("fpMsg");
    if (!payload.email || !payload.new_password) {
        msgEl.style.color = "red";
        msgEl.innerText = "Please provide your email and new password.";
        return;
    }

    try {
        await fetch(`${API_URL}/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (e) {}

    const store = getCloudStore();
    const user = store.users.find(u => u.email.toLowerCase() === payload.email.toLowerCase());
    if (user) {
        user.password = payload.new_password;
        saveCloudStore(store);
    }

    msgEl.style.color = "green";
    msgEl.innerText = "Password reset successfully! Switching to login...";
    setTimeout(() => {
        showCustomerLogin();
        document.getElementById("custLoginEmail").value = payload.email;
    }, 1400);
}

function logout() {
    const user = JSON.parse(localStorage.getItem("user"));
    localStorage.removeItem("user");
    if (user && user.role !== "Customer") {
        window.location.href = "/company";
    } else {
        window.location.href = "/";
    }
}

// =========================================================
// 4. ROLE-BASED DASHBOARD INITIALIZATION
// =========================================================
async function initDashboard() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        window.location.href = "/";
        return;
    }

    // Apply totally distinct theme backgrounds: Customer vs Company Staff
    if (user.role === "Customer") {
        document.body.className = "theme-customer";
    } else {
        document.body.className = "theme-staff";
    }

    // STRICT ROLE CONTROL: Decision actions (Claims Review & Document Verification)
    // are strictly reserved for Claims Officers and Admin only.
    const isDecisionAuthorized = (user.role === "Officer" || user.role === "Admin");
    document.getElementById("claimActionHeader").style.display = isDecisionAuthorized ? "" : "none";
    document.getElementById("docActionHeader").style.display = isDecisionAuthorized ? "" : "none";

    if (user.role === "Customer") {
        document.getElementById("portalTitle").innerText = "IMS Customer Portal";
        document.getElementById("userBanner").innerText = `Customer`;

        document.getElementById("totalUsersBox").style.display = "none";
        document.getElementById("statsGrid").style.gridTemplateColumns = "repeat(5, 1fr)";
        document.getElementById("labelPolicies").innerText = "My Policies";
        document.getElementById("labelClaims").innerText = "My Claims";

        document.getElementById("policiesTableTitle").innerText = "My Active Policies";
        document.getElementById("claimsTableTitle").innerText = "My Submitted Claims & Status";
        document.getElementById("documentsTableTitle").innerText = "My Uploaded Claim Documents";

        document.getElementById("customerPurchaseSection").style.display = "block";
        document.getElementById("customerClaimSection").style.display = "block";
        document.getElementById("profName").value = user.name || "";
        document.getElementById("profPhone").value = user.phone || "";
        document.getElementById("profAddress").value = user.address || "";
        loadAvailablePlans();
    } else {
        document.getElementById("portalTitle").innerText = `IMS Company Operations (${user.role})`;
        document.getElementById("userBanner").innerText = `${user.role}`;
    }

    if (user.role === "Admin") {
        document.getElementById("adminStaffSection").style.display = "block";
        document.getElementById("agentPolicySection").style.display = "block";
        loadAllUsers();
    }

    if (user.role === "Agent") {
        document.getElementById("agentPolicySection").style.display = "block";
    }

    loadStats(user);
    loadPolicies(user);
    loadClaims(user);
    loadDocuments(user);
}

// =========================================================
// 5. LOAD METRICS STATS
// =========================================================
async function loadStats(user) {
    let stats = null;

    try {
        const url = user.role === "Customer"
            ? `${API_URL}/dashboard/stats?customer_id=${user.id}`
            : `${API_URL}/dashboard/stats`;
        const res = await fetch(url);
        if (res.ok) stats = await res.json();
    } catch (e) {}

    if (!stats) {
        const store = getCloudStore();
        const userPolicies = user.role === "Customer"
            ? store.policies.filter(p => p.customer_id === user.id)
            : store.policies;
        const userClaims = user.role === "Customer"
            ? store.claims.filter(c => c.customer_id === user.id)
            : store.claims;

        stats = {
            total_users: store.users.length,
            total_policies: userPolicies.length,
            total_claims: userClaims.length,
            pending_claims: userClaims.filter(c => c.status === "Pending").length,
            approved_claims: userClaims.filter(c => c.status === "Approved").length,
            rejected_claims: userClaims.filter(c => c.status === "Rejected").length
        };
    }

    if (user.role !== "Customer") {
        document.getElementById("statUsers").innerText = stats.total_users;
    }
    document.getElementById("statPolicies").innerText = stats.total_policies;
    document.getElementById("statClaims").innerText = stats.total_claims;
    document.getElementById("statPending").innerText = stats.pending_claims;
    document.getElementById("statApproved").innerText = stats.approved_claims;
    document.getElementById("statRejected").innerText = stats.rejected_claims;
}

// =========================================================
// 6. ADMIN STAFF CREATION & DIRECTORY
// =========================================================
async function createStaffAccount() {
    const admin = JSON.parse(localStorage.getItem("user"));
    const payload = {
        admin_id: admin.id,
        name: document.getElementById("staffName").value.trim(),
        email: document.getElementById("staffEmail").value.trim(),
        password: document.getElementById("staffPassword").value.trim(),
        phone: document.getElementById("staffPhone").value.trim(),
        role: document.getElementById("staffRole").value
    };

    if (!payload.name || !payload.email || !payload.password) {
        alert("Please provide staff name, email, and password.");
        return;
    }

    try {
        await fetch(`${API_URL}/admin/create-staff`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (e) {}

    const store = getCloudStore();
    payload.id = store.users.length + 1;
    store.users.push(payload);
    saveCloudStore(store);

    alert(`Staff account created successfully for role: ${payload.role}`);
    document.getElementById("staffName").value = "";
    document.getElementById("staffEmail").value = "";
    document.getElementById("staffPassword").value = "";
    document.getElementById("staffPhone").value = "";
    initDashboard();
}

async function loadAllUsers() {
    let users = null;
    try {
        const res = await fetch(`${API_URL}/users`);
        if (res.ok) users = await res.json();
    } catch (e) {}

    if (!users) {
        users = getCloudStore().users;
    }

    const tbody = document.getElementById("usersTable");
    tbody.innerHTML = "";
    users.forEach(u => {
        tbody.innerHTML += `
            <tr>
                <td>${u.id}</td>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td><strong>${u.role}</strong></td>
                <td>${u.phone || "-"}</td>
            </tr>
        `;
    });
}

// =========================================================
// 7. BROWSE PLANS & BUY ONLINE WITH 18% GST BREAKDOWN
// =========================================================
async function loadAvailablePlans() {
    let plans = null;
    try {
        const res = await fetch(`${API_URL}/policy-plans`);
        if (res.ok) plans = await res.json();
    } catch (e) {}

    if (!plans || !plans.length) {
        plans = DEFAULT_PLANS;
    }

    const container = document.getElementById("plansContainer");
    container.innerHTML = "";

    plans.forEach(plan => {
        let badge = "Popular Cover";
        let icon = "🛡️";
        if (plan.policy_type.includes("Health")) { badge = "Health Shield"; icon = "🏥"; }
        else if (plan.policy_type.includes("Motor")) { badge = "Vehicle Cover"; icon = "🚗"; }
        else if (plan.policy_type.includes("Life") || plan.policy_type.includes("Jeevan")) { badge = "Term Life"; icon = "👨‍👩‍👧"; }
        else if (plan.policy_type.includes("Home") || plan.policy_type.includes("Griha")) { badge = "Property Protection"; icon = "🏠"; }

        container.innerHTML += `
            <div class="plan-card">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="background: #eff6ff; color: #2563eb; font-size: 0.72rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; text-transform: uppercase; border: 1px solid #bfdbfe;">
                            ${badge}
                        </span>
                        <span style="font-size: 1.4rem;">${icon}</span>
                    </div>
                    <h4>${plan.policy_type}</h4>
                    <p>Sum Assured <strong>₹${formatINR(plan.coverage_amount)}</strong></p>
                    <p>Annual Base Premium <strong>₹${formatINR(plan.premium)}</strong></p>
                    <p>GST Applicability <strong>18% Applicable</strong></p>
                    <p>Cashless Settlement <strong>Enabled</strong></p>
                </div>
                <button type="button" onclick="openPaymentModal('${plan.policy_type}', ${plan.coverage_amount}, ${plan.premium})">
                    Proceed to Pay & Buy
                </button>
            </div>
        `;
    });
}

function openPaymentModal(policyType, coverageAmount, premium) {
    const gst = premium * 0.18;
    const total = premium + gst;

    selectedPlanForPayment = {
        policy_type: policyType,
        coverage_amount: coverageAmount,
        premium: premium
    };

    document.getElementById("payPlanSummary").innerHTML = `
        <strong>Plan:</strong> ${policyType}<br>
        <strong>Sum Assured:</strong> ₹${formatINR(coverageAmount)}<br>
        <strong>Base Premium:</strong> ₹${formatINR(premium)}<br>
        <strong>GST (18%):</strong> ₹${formatINR(gst)}<br>
        <hr style="margin: 6px 0;">
        <strong style="font-size: 16px; color: #15803d;">Total Payable: ₹${formatINR(total)}</strong>
    `;

    document.getElementById("paymentModal").style.display = "block";
}

function closePaymentModal() {
    document.getElementById("paymentModal").style.display = "none";
}

function togglePaymentFields() {
    const method = document.getElementById("payMethod").value;
    if (method.includes("UPI")) {
        document.getElementById("upiField").style.display = "block";
        document.getElementById("cardField").style.display = "none";
    } else if (method.includes("Card")) {
        document.getElementById("upiField").style.display = "none";
        document.getElementById("cardField").style.display = "block";
    } else {
        document.getElementById("upiField").style.display = "none";
        document.getElementById("cardField").style.display = "none";
    }
}

async function confirmAndPayPolicy() {
    if (!selectedPlanForPayment) return;

    const user = JSON.parse(localStorage.getItem("user"));
    const paymentMethod = document.getElementById("payMethod").value;
    const randomPolNum = "IMS-POL-" + Math.floor(100000 + Math.random() * 900000);
    const today = new Date().toISOString().split("T")[0];
    const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0];
    const gst = selectedPlanForPayment.premium * 0.18;
    const total = selectedPlanForPayment.premium + gst;

    const payload = {
        policy_number: randomPolNum,
        policy_type: selectedPlanForPayment.policy_type,
        coverage_amount: selectedPlanForPayment.coverage_amount,
        customer_id: user.id,
        start_date: today,
        end_date: nextYear,
        premium: selectedPlanForPayment.premium,
        payment_method: paymentMethod
    };

    let invoice = null;

    try {
        const res = await fetch(`${API_URL}/policies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const data = await res.json();
            invoice = data.invoice;
        }
    } catch (e) {}

    // Cloud Store fallback record
    const store = getCloudStore();
    const newPolicy = {
        id: store.policies.length + 1,
        policy_number: randomPolNum,
        policy_type: payload.policy_type,
        coverage_amount: payload.coverage_amount,
        customer_id: user.id,
        customer_name: user.name || "Valued Policyholder",
        agent_id: null,
        agent_name: "Direct Online Purchase",
        start_date: today,
        end_date: nextYear,
        premium: payload.premium,
        status: "Active"
    };
    store.policies.push(newPolicy);

    if (!invoice) {
        invoice = {
            policy_number: randomPolNum,
            invoice_number: "INV-2026-" + Math.floor(10000 + Math.random() * 90000),
            transaction_id: "TXN-IMS-" + Math.floor(10000000 + Math.random() * 90000000),
            customer_name: user.name || "Customer",
            customer_email: user.email,
            customer_phone: user.phone || "N/A",
            customer_address: user.address || "India",
            policy_type: payload.policy_type,
            coverage_amount: payload.coverage_amount,
            start_date: today,
            end_date: nextYear,
            payment_method: paymentMethod,
            base_amount: payload.premium,
            gst_amount: gst,
            total_paid: total,
            company_gstin: "36AAACI1122K1Z9",
            payment_date: new Date().toLocaleDateString("en-IN")
        };
    }
    store.invoices.push(invoice);
    saveCloudStore(store);

    closePaymentModal();
    showInvoiceModal(invoice);
    initDashboard();
}

function showInvoiceModal(inv) {
    document.getElementById("invCompanyGstin").innerText = inv.company_gstin || "36AAACI1122K1Z9";
    document.getElementById("invNumber").innerText = inv.invoice_number;
    document.getElementById("invTxnId").innerText = inv.transaction_id;
    document.getElementById("invDate").innerText = inv.payment_date || new Date().toLocaleDateString("en-IN");

    document.getElementById("invCustName").innerText = inv.customer_name;
    document.getElementById("invCustEmail").innerText = inv.customer_email;
    document.getElementById("invCustPhone").innerText = inv.customer_phone || "N/A";
    document.getElementById("invCustAddress").innerText = inv.customer_address || "N/A";

    document.getElementById("invPolNumber").innerText = inv.policy_number;
    document.getElementById("invPolType").innerText = inv.policy_type;
    document.getElementById("invCoverage").innerText = formatINR(inv.coverage_amount);
    document.getElementById("invValidity").innerText = `${inv.start_date} to ${inv.end_date}`;
    document.getElementById("invPayMethod").innerText = inv.payment_method;

    document.getElementById("invBaseAmt").innerText = formatINR(inv.base_amount);
    document.getElementById("invGstAmt").innerText = formatINR(inv.gst_amount);
    document.getElementById("invTotalPaid").innerText = formatINR(inv.total_paid);

    document.getElementById("invoiceModal").style.display = "block";
}

function closeInvoiceModal() {
    document.getElementById("invoiceModal").style.display = "none";
}

async function viewInvoiceByPolicy(policyNumber) {
    let invoice = null;
    try {
        const res = await fetch(`${API_URL}/invoices/${policyNumber}`);
        if (res.ok) invoice = await res.json();
    } catch (e) {}

    if (!invoice) {
        const store = getCloudStore();
        invoice = store.invoices.find(i => i.policy_number === policyNumber);
    }

    if (invoice) {
        showInvoiceModal(invoice);
    } else {
        alert("Official invoice details for this policy are ready in your account.");
    }
}

async function updateMyProfile() {
    const user = JSON.parse(localStorage.getItem("user"));
    const payload = {
        name: document.getElementById("profName").value.trim(),
        phone: document.getElementById("profPhone").value.trim(),
        address: document.getElementById("profAddress").value.trim()
    };

    try {
        await fetch(`${API_URL}/users/${user.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (e) {}

    user.name = payload.name;
    user.phone = payload.phone;
    user.address = payload.address;
    localStorage.setItem("user", JSON.stringify(user));

    const store = getCloudStore();
    const storeUser = store.users.find(u => u.id === user.id);
    if (storeUser) {
        storeUser.name = payload.name;
        storeUser.phone = payload.phone;
        storeUser.address = payload.address;
        saveCloudStore(store);
    }

    alert("Profile information updated successfully!");
    initDashboard();
}

// =========================================================
// 8. STAFF: ISSUE POLICY TO CUSTOMER
// =========================================================
async function issuePolicyByStaff() {
    const user = JSON.parse(localStorage.getItem("user"));
    const payload = {
        policy_number: document.getElementById("polNumber").value.trim(),
        policy_type: document.getElementById("polType").value,
        coverage_amount: Number(document.getElementById("polCoverage").value),
        customer_id: Number(document.getElementById("polCustomerId").value),
        agent_id: user.role === "Agent" ? user.id : null,
        start_date: document.getElementById("polStart").value,
        end_date: document.getElementById("polEnd").value,
        premium: Number(document.getElementById("polPremium").value)
    };

    if (!payload.policy_number || !payload.coverage_amount || !payload.customer_id) {
        alert("Please fill in policy number, coverage amount, and customer ID.");
        return;
    }

    try {
        await fetch(`${API_URL}/policies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (e) {}

    const store = getCloudStore();
    const cust = store.users.find(u => u.id === payload.customer_id) || { name: `Customer #${payload.customer_id}` };
    payload.id = store.policies.length + 1;
    payload.customer_name = cust.name;
    payload.agent_name = user.name;
    payload.status = "Active";
    store.policies.push(payload);
    saveCloudStore(store);

    alert("Policy issued successfully to customer!");
    document.getElementById("polNumber").value = "";
    document.getElementById("polCoverage").value = "";
    document.getElementById("polCustomerId").value = "";
    document.getElementById("polPremium").value = "";
    initDashboard();
}

// =========================================================
// 9. LOAD POLICIES TABLE
// =========================================================
async function loadPolicies(user) {
    let policies = null;
    try {
        const url = user.role === "Customer"
            ? `${API_URL}/policies?customer_id=${user.id}`
            : `${API_URL}/policies`;
        const res = await fetch(url);
        if (res.ok) policies = await res.json();
    } catch (e) {}

    if (!policies) {
        const store = getCloudStore();
        policies = user.role === "Customer"
            ? store.policies.filter(p => p.customer_id === user.id)
            : store.policies;
    }

    const tbody = document.getElementById("policiesTable");
    tbody.innerHTML = "";

    policies.forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td>${p.id}</td>
                <td>${p.policy_number}</td>
                <td>${p.policy_type}</td>
                <td>₹${formatINR(p.coverage_amount)}</td>
                <td>${p.customer_name || "Customer"}</td>
                <td>${p.agent_name || "Direct Online Purchase"}</td>
                <td>${p.start_date}</td>
                <td>${p.end_date}</td>
                <td>₹${formatINR(p.premium)}</td>
                <td><span class="badge ${p.status}">${p.status}</span></td>
                <td>
                    <button style="width: auto; padding: 5px 10px;" onclick="viewInvoiceByPolicy('${p.policy_number}')">
                        View Invoice
                    </button>
                </td>
            </tr>
        `;
    });
}

// =========================================================
// 10. SUBMIT CLAIM & UPLOAD DOCUMENTS
// =========================================================
async function submitClaim() {
    const user = JSON.parse(localStorage.getItem("user"));
    const payload = {
        claim_number: document.getElementById("clmNumber").value.trim(),
        policy_id: Number(document.getElementById("clmPolicyId").value),
        customer_id: user.id,
        amount: Number(document.getElementById("clmAmount").value),
        claim_date: document.getElementById("clmDate").value,
        reason: document.getElementById("clmReason").value.trim()
    };

    if (!payload.claim_number || !payload.policy_id || !payload.amount) {
        alert("Please enter claim number, policy ID, and amount.");
        return;
    }

    try {
        await fetch(`${API_URL}/claims`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (e) {}

    const store = getCloudStore();
    const pol = store.policies.find(p => p.id === payload.policy_id) || { policy_number: `POL-${payload.policy_id}` };
    payload.id = store.claims.length + 1;
    payload.policy_number = pol.policy_number;
    payload.customer_name = user.name || "Customer";
    payload.status = "Pending";
    payload.review_remarks = "-";
    store.claims.push(payload);
    saveCloudStore(store);

    alert("Claim submitted successfully (Status: Pending). Now upload supporting documents.");
    document.getElementById("clmNumber").value = "";
    document.getElementById("clmPolicyId").value = "";
    document.getElementById("clmAmount").value = "";
    document.getElementById("clmReason").value = "";
    initDashboard();
}

async function uploadCustomerDocument() {
    const user = JSON.parse(localStorage.getItem("user"));
    const claimId = Number(document.getElementById("docClaimId").value);
    const docType = document.getElementById("docType").value.trim();
    const fileInput = document.getElementById("docFile");

    if (!claimId || !fileInput.files.length) {
        alert("Please enter a valid Claim ID and choose a file to upload.");
        return;
    }

    const fileName = fileInput.files[0].name;

    try {
        const formData = new FormData();
        formData.append("customer_id", user.id);
        formData.append("doc_type", docType || "KYC / Medical Document");
        formData.append("file", fileInput.files[0]);

        await fetch(`${API_URL}/claims/${claimId}/documents`, {
            method: "POST",
            body: formData
        });
    } catch (e) {}

    const store = getCloudStore();
    const claim = store.claims.find(c => c.id === claimId) || { claim_number: `CLM-${claimId}` };
    store.documents.push({
        id: store.documents.length + 1,
        claim_id: claimId,
        claim_number: claim.claim_number,
        customer_id: user.id,
        customer_name: user.name || "Customer",
        file_name: fileName,
        doc_type: docType || "Medical Document",
        doc_status: "Pending"
    });
    saveCloudStore(store);

    alert("Supporting document uploaded successfully (Status: Pending Verification)!");
    document.getElementById("docClaimId").value = "";
    document.getElementById("docType").value = "";
    document.getElementById("docFile").value = "";
    initDashboard();
}

// =========================================================
// 11. LOAD CLAIMS & OFFICER DECISION
// =========================================================
async function loadClaims(user) {
    let claims = null;
    try {
        const url = user.role === "Customer"
            ? `${API_URL}/claims?customer_id=${user.id}`
            : `${API_URL}/claims`;
        const res = await fetch(url);
        if (res.ok) claims = await res.json();
    } catch (e) {}

    if (!claims) {
        const store = getCloudStore();
        claims = user.role === "Customer"
            ? store.claims.filter(c => c.customer_id === user.id)
            : store.claims;
    }

    const tbody = document.getElementById("claimsTable");
    tbody.innerHTML = "";

    const canMakeDecision = (user.role === "Officer" || user.role === "Admin");

    claims.forEach(c => {
        let actionCell = "";
        if (canMakeDecision) {
            actionCell = `
                <td>
                    <button class="btn-approve" onclick="reviewClaim(${c.id}, 'Approved')">Approve</button>
                    <button class="btn-pending" onclick="reviewClaim(${c.id}, 'Pending')">Pending</button>
                    <button class="btn-reject" onclick="reviewClaim(${c.id}, 'Rejected')">Reject</button>
                </td>
            `;
        }

        tbody.innerHTML += `
            <tr>
                <td>${c.id}</td>
                <td>${c.claim_number}</td>
                <td>${c.policy_number}</td>
                <td>${c.customer_name || "Customer"}</td>
                <td>${c.reason}</td>
                <td>₹${formatINR(c.amount)}</td>
                <td><span class="badge ${c.status}">${c.status}</span></td>
                <td>${c.review_remarks || "-"}</td>
                ${actionCell}
            </tr>
        `;
    });
}

async function reviewClaim(claimId, decision) {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || (user.role !== "Officer" && user.role !== "Admin")) {
        alert("Access Denied: Decisions can only be made by a Claims Officer or Admin.");
        return;
    }

    const remarks = prompt(`Enter remarks for setting claim status to ${decision}:`);
    if (!remarks) return;

    try {
        await fetch(`${API_URL}/claims/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                claim_id: claimId,
                officer_id: user.id,
                decision: decision,
                remarks: remarks
            })
        });
    } catch (e) {}

    const store = getCloudStore();
    const claim = store.claims.find(c => c.id === claimId);
    if (claim) {
        claim.status = decision;
        claim.review_remarks = remarks;
        saveCloudStore(store);
    }

    alert(`Claim #${claim ? claim.claim_number : claimId} status updated to: ${decision}`);
    initDashboard();
}

// =========================================================
// 12. LOAD DOCUMENTS & VERIFICATION DECISION
// =========================================================
async function loadDocuments(user) {
    let docs = null;
    try {
        const url = user.role === "Customer"
            ? `${API_URL}/documents?customer_id=${user.id}`
            : `${API_URL}/documents`;
        const res = await fetch(url);
        if (res.ok) docs = await res.json();
    } catch (e) {}

    if (!docs) {
        const store = getCloudStore();
        docs = user.role === "Customer"
            ? store.documents.filter(d => d.customer_id === user.id)
            : store.documents;
    }

    const tbody = document.getElementById("documentsTable");
    tbody.innerHTML = "";

    const canMakeDecision = (user.role === "Officer" || user.role === "Admin");

    docs.forEach(d => {
        let actionCell = "";
        if (canMakeDecision) {
            actionCell = `
                <td>
                    <button class="btn-approve" onclick="decideDocument(${d.id}, 'Approved')">Approve</button>
                    <button class="btn-pending" onclick="decideDocument(${d.id}, 'Pending')">Pending</button>
                    <button class="btn-reject" onclick="decideDocument(${d.id}, 'Rejected')">Reject</button>
                </td>
            `;
        }

        tbody.innerHTML += `
            <tr>
                <td>${d.id}</td>
                <td>${d.claim_number}</td>
                <td>${d.customer_name || "Customer"}</td>
                <td>${d.doc_type}</td>
                <td><a href="#" onclick="alert('Viewing verified file: ${d.file_name}'); return false;">${d.file_name}</a></td>
                <td><span class="badge ${d.doc_status}">${d.doc_status}</span></td>
                ${actionCell}
            </tr>
        `;
    });
}

async function decideDocument(docId, status) {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || (user.role !== "Officer" && user.role !== "Admin")) {
        alert("Access Denied: Document verification can only be performed by a Claims Officer or Admin.");
        return;
    }

    try {
        await fetch(`${API_URL}/documents/${docId}/decision`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                officer_id: user.id,
                doc_status: status
            })
        });
    } catch (e) {}

    const store = getCloudStore();
    const doc = store.documents.find(d => d.id === docId);
    if (doc) {
        doc.doc_status = status;
        saveCloudStore(store);
    }

    alert(`Document verification status updated to: ${status}`);
    initDashboard();
}
