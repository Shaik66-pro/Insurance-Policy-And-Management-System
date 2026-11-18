from database import get_db

# Service file for Customer Self-Registration, Password Reset, Admin Staff Creation, and Login

def register_customer(data):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Step 1: Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (data["email"],))
        if cursor.fetchone():
            return False, "Email is already registered"

        # Step 2: Insert Customer account (Role strictly forced to 'Customer')
        cursor.execute("""
            INSERT INTO users (name, email, password, role, phone, address)
            VALUES (%s, %s, %s, 'Customer', %s, %s)
        """, (
            data["name"],
            data["email"],
            data["password"],
            data["phone"],
            data["address"]
        ))

        # Step 3: Save changes
        conn.commit()
        return True, "Customer account created successfully. Please login."

    except Exception as e:
        conn.rollback()
        print("Error in register_customer:", e)
        raise

    finally:
        cursor.close()
        conn.close()


def reset_customer_password(email, phone, new_password):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Step 1: Verify Customer account matches email and registered phone number
        cursor.execute("""
            SELECT id FROM users
            WHERE email = %s AND phone = %s AND role = 'Customer'
        """, (email, phone))
        customer = cursor.fetchone()

        if not customer:
            return False, "No Customer account found matching that email and registered phone number"

        # Step 2: Update password
        cursor.execute("""
            UPDATE users
            SET password = %s
            WHERE id = %s
        """, (new_password, customer[0]))

        # Step 3: Save changes
        conn.commit()
        return True, "Password reset successfully. Please login with your new password."

    except Exception as e:
        conn.rollback()
        print("Error in reset_customer_password:", e)
        raise

    finally:
        cursor.close()
        conn.close()


def create_staff_user(admin_id, data):
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Step 1: Verify requester is Admin
        cursor.execute("SELECT role FROM users WHERE id = %s", (admin_id,))
        admin_record = cursor.fetchone()

        if not admin_record or admin_record[0] != "Admin":
            return False, "Access Denied: Only Admin can create Agent or Claims Officer accounts"

        # Step 2: Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (data["email"],))
        if cursor.fetchone():
            return False, "User with this email already exists"

        # Step 3: Insert Agent or Claims Officer
        address = data.get("address", "Branch Office")
        cursor.execute("""
            INSERT INTO users (name, email, password, role, phone, address)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            data["name"],
            data["email"],
            data["password"],
            data["role"],
            data["phone"],
            address
        ))

        # Step 4: Save changes
        conn.commit()
        return True, data["role"] + " account created successfully"

    except Exception as e:
        conn.rollback()
        print("Error in create_staff_user:", e)
        raise

    finally:
        cursor.close()
        conn.close()


def login_user(email, password):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT id, name, email, role, phone, address
            FROM users
            WHERE email = %s AND password = %s
        """, (email, password))

        user = cursor.fetchone()
        return user

    except Exception as e:
        print("Error in login_user:", e)
        raise

    finally:
        cursor.close()
        conn.close()