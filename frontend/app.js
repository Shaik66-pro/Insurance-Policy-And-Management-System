const API_URL = "http://127.0.0.1:5000";
let selectedPlanForPayment = null;

// Helper to format Indian Rupees cleanly
function formatINR(amount) {
    return Number(amount).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Switch between Registration, Login, and Forgot Password on Customer Portal
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

// 1. Portal-Aware Login
async function handlePortalLogin(portalType) {
    const email = portalType === "Customer"
        ? document.getElementById("custLoginEmail").value
        : document.getElementById("staffLoginEmail").value;

    const password = portalType === "Customer"
        ? document.getElementById("custLoginPassword").value
        : document.getElementById("staffLoginPassword").value;

    const msgEl = portalType === "Customer"
        ? document.getElementById("custLoginMsg")
        : document.getElementById("staffLoginMsg");

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) {
            msgEl.innerText = data.error || "Invalid credentials";
            return;
        }

        const user = data.user;

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
    } catch (err) {
        msgEl.innerText = "Server connection error. Make sure Flask app.py is running.";
    }
}

// 2. Customer Self-Registration
async function handleCustomerRegister() {
    const payload = {
        name: document.getElementById("regName").value,
        email: document.getElementById("regEmail").value,
        password: document.getElementById("regPassword").value,
        phone: document.getElementById("regPhone").value,
        address: document.getElementById("regAddress").value,
        role: "Customer"
    };

    const msgEl = document.getElementById("regMsg");
    msgEl.style.color = "#1e3a8a";
    msgEl.innerText = "Creating your customer account...";

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            msgEl.style.color = "green";
            msgEl.innerText = data.message + " Switching to login...";
            setTimeout(() => {
                showCustomerLogin();
                document.getElementById("custLoginEmail").value = payload.email;
            }, 1200);
        } else {
            msgEl.style.color = "red";
            msgEl.innerText = data.error || data.message;
        }
    } catch (err) {
        msgEl.style.color = "red";
        msgEl.innerText = "Unable to reach server. Make sure Flask app.py is running.";
    }
}

// 3. Customer Forgot Password
async function handleForgotPassword() {
    const payload = {
        email: document.getElementById("fpEmail").value,
        phone: document.getElementById("fpPhone").value,
        new_password: document.getElementById("fpNewPassword").value
    };

    const msgEl = document.getElementById("fpMsg");
    try {
        const res = await fetch(`${API_URL}/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            msgEl.style.color = "green";
            msgEl.innerText = data.message;
            setTimeout(() => {
                showCustomerLogin();
                document.getElementById("custLoginEmail").value = payload.email;
            }, 1500);
        } else {
            msgEl.style.color = "red";
            msgEl.innerText = data.error || "Password reset failed";
        }
    } catch (err) {
        msgEl.style.color = "red";
        msgEl.innerText = "Server error while resetting password.";
    }
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

// 4. Role-Based Dashboard Initialization
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

// 5. Load Role-Scoped Dashboard Stats
async function loadStats(user) {
    const url = user.role === "Customer"
        ? `${API_URL}/dashboard/stats?customer_id=${user.id}`
        : `${API_URL}/dashboard/stats`;

    const res = await fetch(url);
    const stats = await res.json();

    if (user.role !== "Customer") {
        document.getElementById("statUsers").innerText = stats.total_users;
    }
    document.getElementById("statPolicies").innerText = stats.total_policies;
    document.getElementById("statClaims").innerText = stats.total_claims;
    document.getElementById("statPending").innerText = stats.pending_claims;
    document.getElementById("statApproved").innerText = stats.approved_claims;
    document.getElementById("statRejected").innerText = stats.rejected_claims;
}

// 6. Admin Only: Create Agent or Claims Officer
async function createStaffAccount() {
    const admin = JSON.parse(localStorage.getItem("user"));
    const payload = {
        admin_id: admin.id,
        name: document.getElementById("staffName").value,
        email: document.getElementById("staffEmail").value,
        password: document.getElementById("staffPassword").value,
        phone: document.getElementById("staffPhone").value,
        role: document.getElementById("staffRole").value
    };

    const res = await fetch(`${API_URL}/admin/create-staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(data.message || data.error);
    initDashboard();
}

async function loadAllUsers() {
    const res = await fetch(`${API_URL}/users`);
    const users = await res.json();
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

// 7. Customer Only: Browse INR Plans & Open Payment Gateway
async function loadAvailablePlans() {
    const res = await fetch(`${API_URL}/policy-plans`);
    const plans = await res.json();
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

    const res = await fetch(`${API_URL}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    closePaymentModal();

    if (res.ok && data.invoice) {
        showInvoiceModal(data.invoice);
        initDashboard();
    } else {
        alert(data.message || data.error);
    }
}

function showInvoiceModal(inv) {
    document.getElementById("invCompanyGstin").innerText = inv.company_gstin;
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
    const res = await fetch(`${API_URL}/invoices/${policyNumber}`);
    const data = await res.json();
    if (res.ok) {
        showInvoiceModal(data);
    } else {
        alert(data.error || "Invoice details not available");
    }
}

async function updateMyProfile() {
    const user = JSON.parse(localStorage.getItem("user"));
    const payload = {
        name: document.getElementById("profName").value,
        phone: document.getElementById("profPhone").value,
        address: document.getElementById("profAddress").value
    };

    const res = await fetch(`${API_URL}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    user.name = payload.name;
    user.phone = payload.phone;
    user.address = payload.address;
    localStorage.setItem("user", JSON.stringify(user));
    alert(data.message || data.error);
    initDashboard();
}

// 8. Agent / Admin: Issue Policy to Customer
async function issuePolicyByStaff() {
    const user = JSON.parse(localStorage.getItem("user"));
    const payload = {
        policy_number: document.getElementById("polNumber").value,
        policy_type: document.getElementById("polType").value,
        coverage_amount: document.getElementById("polCoverage").value,
        customer_id: document.getElementById("polCustomerId").value,
        agent_id: user.role === "Agent" ? user.id : null,
        start_date: document.getElementById("polStart").value,
        end_date: document.getElementById("polEnd").value,
        premium: document.getElementById("polPremium").value
    };

    const res = await fetch(`${API_URL}/policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(data.message || data.error);
    initDashboard();
}

// 9. Load Policies Table (INR ₹ + View Official Tax Invoice Button)
async function loadPolicies(user) {
    const url = user.role === "Customer"
        ? `${API_URL}/policies?customer_id=${user.id}`
        : `${API_URL}/policies`;

    const res = await fetch(url);
    const policies = await res.json();
    const tbody = document.getElementById("policiesTable");
    tbody.innerHTML = "";

    policies.forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td>${p.id}</td>
                <td>${p.policy_number}</td>
                <td>${p.policy_type}</td>
                <td>₹${formatINR(p.coverage_amount)}</td>
                <td>${p.customer_name}</td>
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

// 10. Customer: Submit Claim & Upload Document
async function submitClaim() {
    const user = JSON.parse(localStorage.getItem("user"));
    const payload = {
        claim_number: document.getElementById("clmNumber").value,
        policy_id: document.getElementById("clmPolicyId").value,
        customer_id: user.id,
        amount: document.getElementById("clmAmount").value,
        claim_date: document.getElementById("clmDate").value,
        reason: document.getElementById("clmReason").value
    };

    const res = await fetch(`${API_URL}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(data.message || data.error);
    initDashboard();
}

async function uploadCustomerDocument() {
    const user = JSON.parse(localStorage.getItem("user"));
    const claimId = document.getElementById("docClaimId").value;
    const docType = document.getElementById("docType").value;
    const fileInput = document.getElementById("docFile");

    if (!fileInput.files.length) {
        alert("Please select a document file to upload.");
        return;
    }

    const formData = new FormData();
    formData.append("customer_id", user.id);
    formData.append("doc_type", docType);
    formData.append("file", fileInput.files[0]);

    const res = await fetch(`${API_URL}/claims/${claimId}/documents`, {
        method: "POST",
        body: formData
    });

    const data = await res.json();
    alert(data.message || data.error);
    initDashboard();
}

// 11. Load Claims (INR ₹)
async function loadClaims(user) {
    const url = user.role === "Customer"
        ? `${API_URL}/claims?customer_id=${user.id}`
        : `${API_URL}/claims`;

    const res = await fetch(url);
    const claims = await res.json();
    const tbody = document.getElementById("claimsTable");
    tbody.innerHTML = "";

    claims.forEach(c => {
        let actionCell = "";
        if (user.role === "Officer" || user.role === "Admin") {
            actionCell = `
                <td>
                    <button class="btn-approve" onclick="reviewClaim(${c.id}, 'Approved')">Approved</button>
                    <button class="btn-pending" onclick="reviewClaim(${c.id}, 'Pending')">Pending</button>
                    <button class="btn-reject" onclick="reviewClaim(${c.id}, 'Rejected')">Rejected</button>
                </td>
            `;
        }

        tbody.innerHTML += `
            <tr>
                <td>${c.id}</td>
                <td>${c.claim_number}</td>
                <td>${c.policy_number}</td>
                <td>${c.customer_name}</td>
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

    const res = await fetch(`${API_URL}/claims/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            claim_id: claimId,
            officer_id: user.id,
            decision: decision,
            remarks: remarks
        })
    });

    const data = await res.json();
    alert(data.message || data.error);
    initDashboard();
}

// 12. Load Documents
async function loadDocuments(user) {
    const url = user.role === "Customer"
        ? `${API_URL}/documents?customer_id=${user.id}`
        : `${API_URL}/documents`;

    const res = await fetch(url);
    const docs = await res.json();
    const tbody = document.getElementById("documentsTable");
    tbody.innerHTML = "";

    docs.forEach(d => {
        let actionCell = "";
        if (user.role === "Officer" || user.role === "Admin") {
            actionCell = `
                <td>
                    <button class="btn-approve" onclick="decideDocument(${d.id}, 'Approved')">Approved</button>
                    <button class="btn-pending" onclick="decideDocument(${d.id}, 'Pending')">Pending</button>
                    <button class="btn-reject" onclick="decideDocument(${d.id}, 'Rejected')">Rejected</button>
                </td>
            `;
        }

        tbody.innerHTML += `
            <tr>
                <td>${d.id}</td>
                <td>${d.claim_number}</td>
                <td>${d.customer_name}</td>
                <td>${d.doc_type}</td>
                <td><a href="${API_URL}/uploads/${d.file_name}" target="_blank">${d.file_name}</a></td>
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

    const res = await fetch(`${API_URL}/documents/${docId}/decision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            officer_id: user.id,
            doc_status: status
        })
    });

    const data = await res.json();
    alert(data.message || data.error);
    initDashboard();
}