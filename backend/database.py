import mysql.connector

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "S@m123"
}

DB_NAME = "insurance_db"


def get_db():
    conn = mysql.connector.connect(
        host=DB_CONFIG["host"],
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"],
        database=DB_NAME
    )
    return conn


def init_db():
    conn = None
    cursor = None
    try:
        # Step 1: Connect to MySQL Server
        conn = mysql.connector.connect(
            host=DB_CONFIG["host"],
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"]
        )
        cursor = conn.cursor()

        # Step 2: Create database if not exists
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
        cursor.execute(f"USE {DB_NAME}")

        # Step 3: Create Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('Admin', 'Customer', 'Agent', 'Officer') NOT NULL,
                phone VARCHAR(20),
                address VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Step 4: Create Policies Table (Indian Rupees ₹)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS policies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                policy_number VARCHAR(50) UNIQUE NOT NULL,
                policy_type VARCHAR(50) NOT NULL,
                coverage_amount DECIMAL(14, 2) NOT NULL,
                customer_id INT NOT NULL,
                agent_id INT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                premium DECIMAL(12, 2) NOT NULL,
                status ENUM('Active', 'Expired', 'Pending') DEFAULT 'Active',
                FOREIGN KEY (customer_id) REFERENCES users(id),
                FOREIGN KEY (agent_id) REFERENCES users(id)
            )
        """)

        # Step 5: Create Payments & Official Tax Invoice Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_number VARCHAR(50) UNIQUE NOT NULL,
                transaction_id VARCHAR(50) UNIQUE NOT NULL,
                policy_number VARCHAR(50) NOT NULL,
                customer_id INT NOT NULL,
                payment_method VARCHAR(50) NOT NULL,
                base_amount DECIMAL(12, 2) NOT NULL,
                gst_amount DECIMAL(12, 2) NOT NULL,
                total_paid DECIMAL(12, 2) NOT NULL,
                company_gstin VARCHAR(30) NOT NULL,
                payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES users(id)
            )
        """)

        # Step 6: Create Claims Table (3 Live Statuses: Pending, Approved, Rejected)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS claims (
                id INT AUTO_INCREMENT PRIMARY KEY,
                claim_number VARCHAR(50) UNIQUE NOT NULL,
                policy_id INT NOT NULL,
                customer_id INT NOT NULL,
                reason TEXT NOT NULL,
                amount DECIMAL(12, 2) NOT NULL,
                claim_date DATE NOT NULL,
                status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
                FOREIGN KEY (policy_id) REFERENCES policies(id),
                FOREIGN KEY (customer_id) REFERENCES users(id)
            )
        """)

        # Step 7: Create Documents Table (3 Live Statuses: Pending, Approved, Rejected)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                claim_id INT NOT NULL,
                customer_id INT NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(255) NOT NULL,
                doc_type VARCHAR(50) NOT NULL,
                doc_status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
                uploaded_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (claim_id) REFERENCES claims(id),
                FOREIGN KEY (customer_id) REFERENCES users(id)
            )
        """)

        # Step 8: Create Reviews Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                claim_id INT NOT NULL,
                officer_id INT NOT NULL,
                decision ENUM('Pending', 'Approved', 'Rejected') NOT NULL,
                remarks TEXT,
                review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (claim_id) REFERENCES claims(id),
                FOREIGN KEY (officer_id) REFERENCES users(id)
            )
        """)

        # Step 9: Create Default Master Admin Account
        cursor.execute("SELECT id FROM users WHERE email = %s", ("admin@insure.com",))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO users (name, email, password, role, phone, address)
                VALUES (%s, %s, %s, 'Admin', %s, %s)
            """, (
                "IMS System Admin",
                "admin@insure.com",
                "admin123",
                "9000000000",
                "IMS Corporate Tower, HITEC City, Hyderabad"
            ))

        conn.commit()
        print("[OK] IMS MySQL Database, Tables, and Payments Ledger verified!")

    except Exception as e:
        print("[ERROR] Database initialization failed:", e)
        raise

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()