import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Importing all .py modules into app.py
from database import get_db, init_db
from validation import (
    validate_customer_registration,
    validate_staff_creation,
    validate_policy,
    validate_claim,
    validate_review,
    validate_document_decision
)
from auth_service import (
    register_customer,
    reset_customer_password,
    create_staff_user,
    login_user
)
from policy_service import create_or_purchase_policy
from claim_service import (
    add_claim,
    save_customer_document,
    update_document_status,
    review_claim
)
from seed_data import seed_initial_data

# Locate frontend and uploads folders automatically
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Automatically initialize MySQL database, tables, Admin account, and demo data
init_db()
seed_initial_data()


# =========================================================
# FRONTEND ROUTES (TWO SEPARATE PORTALS)
# =========================================================

@app.route("/", methods=["GET"])
def customer_portal():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/company", methods=["GET"])
def company_portal():
    return send_from_directory(FRONTEND_DIR, "company.html")


@app.route("/dashboard.html", methods=["GET"])
def dashboard_page():
    return send_from_directory(FRONTEND_DIR, "dashboard.html")


@app.route("/uploads/<path:filename>", methods=["GET"])
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# =========================================================
# 1. AUTHENTICATION, FORGOT PASSWORD & ROLE-BASED ACCESS
# =========================================================

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON required"}), 400

    if "role" in data and data["role"] != "Customer":
        return jsonify({"error": "Public registration is only for Customers. Staff accounts are created by Admin."}), 403

    error = validate_customer_registration(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        success, message = register_customer(data)
        if success:
            return jsonify({"message": message}), 201
        return jsonify({"message": message}), 409
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to register customer"}), 500


@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON required"}), 400

    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    new_password = data.get("new_password", "").strip()

    if not email or not phone or not new_password:
        return jsonify({"error": "Email, registered phone number, and new password are required"}), 400

    if len(new_password) < 4:
        return jsonify({"error": "New password must be at least 4 characters long"}), 400

    try:
        success, message = reset_customer_password(email, phone, new_password)
        if success:
            return jsonify({"message": message}), 200
        return jsonify({"error": message}), 404
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to reset password"}), 500


@app.route("/admin/create-staff", methods=["POST"])
def admin_create_staff():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON required"}), 400

    admin_id = data.get("admin_id")
    if not admin_id:
        return jsonify({"error": "admin_id is required"}), 400

    error = validate_staff_creation(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        success, message = create_staff_user(admin_id, data)
        if success:
            return jsonify({"message": message}), 201
        return jsonify({"error": message}), 403
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to create staff user"}), 500


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON required"}), 400

    if not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password are required"}), 400

    try:
        user = login_user(data["email"], data["password"])
        if user:
            return jsonify({"message": "Login successful", "user": user}), 200
        return jsonify({"error": "Invalid email or password"}), 401
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to login"}), 500


@app.route("/users", methods=["GET"])
def get_users():
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, email, role, phone, address, created_at FROM users")
        users = cursor.fetchall()
        cursor.close()
        return jsonify(users), 200
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to fetch users"}), 500
    finally:
        if conn:
            conn.close()


@app.route("/users/<int:id>", methods=["PUT"])
def update_user_profile(id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON required"}), 400

    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = %s", (id,))
        if not cursor.fetchone():
            return jsonify({"message": "User not found"}), 404

        cursor.execute("""
            UPDATE users
            SET name = %s, phone = %s, address = %s
            WHERE id = %s
        """, (data.get("name"), data.get("phone"), data.get("address"), id))
        conn.commit()
        cursor.close()
        return jsonify({"message": "Profile updated successfully"}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print(e)
        return jsonify({"error": "Unable to update profile"}), 500
    finally:
        if conn:
            conn.close()


# =========================================================
# 2. POLICIES (INR PLANS, PAYMENT & OFFICIAL GST INVOICE)
# =========================================================

@app.route("/policy-plans", methods=["GET"])
def get_policy_plans():
    plans = [
        {"policy_type": "IMS Health Shield Plus", "coverage_amount": 500000, "premium": 8500, "duration_years": 1},
        {"policy_type": "IMS Comprehensive Motor Cover", "coverage_amount": 300000, "premium": 4200, "duration_years": 1},
        {"policy_type": "IMS Jeevan Suraksha Term Life", "coverage_amount": 10000000, "premium": 12000, "duration_years": 1},
        {"policy_type": "IMS Griha Raksha Home Plan", "coverage_amount": 2500000, "premium": 6500, "duration_years": 1}
    ]
    return jsonify(plans), 200


@app.route("/policies", methods=["GET"])
def get_policies():
    customer_id = request.args.get("customer_id")
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        base_query = """
            SELECT p.*, c.name AS customer_name, a.name AS agent_name,
                   pay.invoice_number, pay.transaction_id, pay.total_paid
            FROM policies p
            JOIN users c ON p.customer_id = c.id
            LEFT JOIN users a ON p.agent_id = a.id
            LEFT JOIN payments pay ON p.policy_number = pay.policy_number
        """

        if customer_id:
            cursor.execute(base_query + " WHERE p.customer_id = %s", (customer_id,))
        else:
            cursor.execute(base_query)

        policies = cursor.fetchall()
        cursor.close()
        return jsonify(policies), 200
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to fetch policies"}), 500
    finally:
        if conn:
            conn.close()


@app.route("/policies", methods=["POST"])
def create_policy():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON required"}), 400

    error = validate_policy(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        success, message, invoice = create_or_purchase_policy(data)
        if success:
            return jsonify({"message": message, "invoice": invoice}), 201
        return jsonify({"message": message}), 409
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to process policy and payment"}), 500


@app.route("/invoices/<string:policy_number>", methods=["GET"])
def get_invoice_by_policy(policy_number):
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT pay.*, p.policy_type, p.coverage_amount, p.start_date, p.end_date,
                   u.name AS customer_name, u.email AS customer_email,
                   u.phone AS customer_phone, u.address AS customer_address
            FROM payments pay
            JOIN policies p ON pay.policy_number = p.policy_number
            JOIN users u ON pay.customer_id = u.id
            WHERE pay.policy_number = %s
        """, (policy_number,))
        invoice = cursor.fetchone()

        if invoice:
            cursor.close()
            return jsonify(invoice), 200

        # Fallback: generate invoice details for policies purchased before payments table was added
        cursor.execute("""
            SELECT p.*, u.name AS customer_name, u.email AS customer_email,
                   u.phone AS customer_phone, u.address AS customer_address
            FROM policies p
            JOIN users u ON p.customer_id = u.id
            WHERE p.policy_number = %s
        """, (policy_number,))
        policy = cursor.fetchone()
        cursor.close()

        if not policy:
            return jsonify({"error": "Policy not found"}), 404

        base_amount = round(float(policy["premium"]), 2)
        gst_amount = round(base_amount * 0.18, 2)
        total_paid = round(base_amount + gst_amount, 2)

        return jsonify({
            "invoice_number": f"INV-IMS-{policy['id']}0982",
            "transaction_id": f"TXN98765432{policy['id']}",
            "policy_number": policy["policy_number"],
            "policy_type": policy["policy_type"],
            "coverage_amount": float(policy["coverage_amount"]),
            "start_date": str(policy["start_date"]),
            "end_date": str(policy["end_date"]),
            "customer_name": policy["customer_name"],
            "customer_email": policy["customer_email"],
            "customer_phone": policy["customer_phone"],
            "customer_address": policy["customer_address"],
            "payment_method": "Online Payment",
            "base_amount": base_amount,
            "gst_amount": gst_amount,
            "total_paid": total_paid,
            "company_gstin": "36AABCI9428M1Z5"
        }), 200
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to fetch invoice"}), 500
    finally:
        if conn:
            conn.close()


# =========================================================
# 3. CLAIMS, DOCUMENT UPLOAD & 3-STATUS LIVE DECISIONS
# =========================================================

@app.route("/claims", methods=["GET"])
def get_claims():
    customer_id = request.args.get("customer_id")
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT c.*, p.policy_number, p.policy_type, u.name AS customer_name,
                   r.decision AS review_decision, r.remarks AS review_remarks
            FROM claims c
            JOIN policies p ON c.policy_id = p.id
            JOIN users u ON c.customer_id = u.id
            LEFT JOIN reviews r ON c.id = r.claim_id
        """

        if customer_id:
            cursor.execute(query + " WHERE c.customer_id = %s", (customer_id,))
        else:
            cursor.execute(query)

        claims = cursor.fetchall()
        cursor.close()
        return jsonify(claims), 200
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to fetch claims"}), 500
    finally:
        if conn:
            conn.close()


@app.route("/claims", methods=["POST"])
def create_claim():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON required"}), 400

    error = validate_claim(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        success, message = add_claim(data)
        if success:
            return jsonify({"message": message}), 201
        return jsonify({"message": message}), 409
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to submit claim"}), 500


@app.route("/claims/<int:claim_id>/documents", methods=["POST"])
def upload_document(claim_id):
    if "file" not in request.files:
        return jsonify({"error": "Document file is required"}), 400

    customer_id = request.form.get("customer_id")
    doc_type = request.form.get("doc_type", "Customer Supporting Document")
    file = request.files["file"]

    if not customer_id:
        return jsonify({"error": "customer_id is required"}), 400

    if file.filename == "":
        return jsonify({"error": "Please select a valid file"}), 400

    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(file_path)

    try:
        success, message = save_customer_document(claim_id, customer_id, filename, file_path, doc_type)
        if success:
            return jsonify({"message": message}), 201
        return jsonify({"message": message}), 404
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to upload document"}), 500


@app.route("/documents", methods=["GET"])
def get_documents():
    customer_id = request.args.get("customer_id")
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT d.*, c.claim_number, u.name AS customer_name
            FROM documents d
            JOIN claims c ON d.claim_id = c.id
            JOIN users u ON d.customer_id = u.id
        """

        if customer_id:
            cursor.execute(query + " WHERE d.customer_id = %s", (customer_id,))
        else:
            cursor.execute(query)

        documents = cursor.fetchall()
        cursor.close()
        return jsonify(documents), 200
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to fetch documents"}), 500
    finally:
        if conn:
            conn.close()


@app.route("/documents/<int:doc_id>/decision", methods=["PUT"])
def decide_document(doc_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON required"}), 400

    error = validate_document_decision(data)
    if error:
        return jsonify({"error": error}), 400

    officer_id = data.get("officer_id")
    if not officer_id:
        return jsonify({"error": "officer_id is required"}), 400

    try:
        success, message = update_document_status(doc_id, officer_id, data["doc_status"])
        if success:
            return jsonify({"message": message}), 200
        return jsonify({"error": message}), 403
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to update document status"}), 500


@app.route("/claims/review", methods=["POST"])
def submit_claim_review():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON required"}), 400

    error = validate_review(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        success, message = review_claim(data)
        if success:
            return jsonify({"message": message}), 200
        return jsonify({"error": message}), 403
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to submit claim review"}), 500


# =========================================================
# 4. ROLE-SCOPED DASHBOARD METRICS API
# =========================================================

@app.route("/dashboard/stats", methods=["GET"])
def get_dashboard_stats():
    customer_id = request.args.get("customer_id")
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        if customer_id:
            cursor.execute("SELECT COUNT(*) AS total_policies FROM policies WHERE customer_id = %s", (customer_id,))
            total_policies = cursor.fetchone()["total_policies"]

            cursor.execute("SELECT COUNT(*) AS total_claims FROM claims WHERE customer_id = %s", (customer_id,))
            total_claims = cursor.fetchone()["total_claims"]

            cursor.execute("SELECT COUNT(*) AS pending_claims FROM claims WHERE customer_id = %s AND status = 'Pending'", (customer_id,))
            pending_claims = cursor.fetchone()["pending_claims"]

            cursor.execute("SELECT COUNT(*) AS approved_claims FROM claims WHERE customer_id = %s AND status = 'Approved'", (customer_id,))
            approved_claims = cursor.fetchone()["approved_claims"]

            cursor.execute("SELECT COUNT(*) AS rejected_claims FROM claims WHERE customer_id = %s AND status = 'Rejected'", (customer_id,))
            rejected_claims = cursor.fetchone()["rejected_claims"]

            cursor.close()
            return jsonify({
                "total_policies": total_policies,
                "total_claims": total_claims,
                "pending_claims": pending_claims,
                "approved_claims": approved_claims,
                "rejected_claims": rejected_claims
            }), 200

        cursor.execute("SELECT COUNT(*) AS total_users FROM users")
        total_users = cursor.fetchone()["total_users"]

        cursor.execute("SELECT COUNT(*) AS total_policies FROM policies")
        total_policies = cursor.fetchone()["total_policies"]

        cursor.execute("SELECT COUNT(*) AS total_claims FROM claims")
        total_claims = cursor.fetchone()["total_claims"]

        cursor.execute("SELECT COUNT(*) AS pending_claims FROM claims WHERE status = 'Pending'")
        pending_claims = cursor.fetchone()["pending_claims"]

        cursor.execute("SELECT COUNT(*) AS approved_claims FROM claims WHERE status = 'Approved'")
        approved_claims = cursor.fetchone()["approved_claims"]

        cursor.execute("SELECT COUNT(*) AS rejected_claims FROM claims WHERE status = 'Rejected'")
        rejected_claims = cursor.fetchone()["rejected_claims"]

        cursor.close()
        return jsonify({
            "total_users": total_users,
            "total_policies": total_policies,
            "total_claims": total_claims,
            "pending_claims": pending_claims,
            "approved_claims": approved_claims,
            "rejected_claims": rejected_claims
        }), 200
    except Exception as e:
        print(e)
        return jsonify({"error": "Unable to load stats"}), 500
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    app.run(debug=True)