const API_URL = 'http://localhost:5000/api';
let selectedType = 'worker';

// Check if already logged in
const token = localStorage.getItem('token');
const userType = localStorage.getItem('userType');

if (token && userType) {
    if (userType === 'worker') {
        window.location.href = 'worker-dashboard.html';
    } else if (userType === 'employer') {
        window.location.href = 'employer-dashboard.html';
    }
}

// User type selection with animation
document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        selectedType = this.dataset.type;
        
        // Add haptic feedback
        this.style.transform = 'scale(0.98)';
        setTimeout(() => { this.style.transform = ''; }, 100);
    });
});

// Send OTP
document.getElementById('sendOtpBtn').addEventListener('click', async () => {
    const phone = document.getElementById('phone').value;
    const name = document.getElementById('name').value;
    
    // Validation
    if (!phone || phone.length < 10) {
        showMessage('❌ Please enter a valid 10-digit phone number', 'error');
        return;
    }
    
    if (!name || name.trim() === '') {
        showMessage('❌ Please enter your name', 'error');
        return;
    }
    
    // Show loading state
    const btn = document.getElementById('sendOtpBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Sending...';
    btn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('✅ OTP sent successfully! Check your backend terminal', 'success');
            document.getElementById('otpSection').style.display = 'block';
            document.getElementById('sendOtpBtn').style.display = 'none';
            window.currentPhone = phone;
            window.currentName = name;
            
            // Auto-focus OTP field
            document.getElementById('otp').focus();
        } else {
            showMessage('❌ Failed to send OTP. Try again.', 'error');
        }
    } catch (error) {
        showMessage('❌ Server error. Make sure backend is running on port 5000', 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// Verify OTP
document.getElementById('verifyBtn').addEventListener('click', async () => {
    const otp = document.getElementById('otp').value;
    const name = window.currentName;
    const phone = window.currentPhone;
    
    if (!otp || otp.length < 4) {
        showMessage('❌ Please enter the 4-digit OTP', 'error');
        return;
    }
    
    const btn = document.getElementById('verifyBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Verifying...';
    btn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp, userType: selectedType, name })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userType', data.user.userType);
            localStorage.setItem('userId', data.user.id);
            
            showMessage('✅ Login successful! Redirecting...', 'success');
            
            setTimeout(() => {
                if (data.user.userType === 'worker') {
                    window.location.href = 'worker-dashboard.html';
                } else {
                    window.location.href = 'employer-dashboard.html';
                }
            }, 1000);
        } else {
            showMessage('❌ ' + (data.error || 'Invalid OTP'), 'error');
        }
    } catch (error) {
        showMessage('❌ Verification failed. Please try again.', 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

// Enter key support
document.getElementById('phone').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('sendOtpBtn').click();
});
document.getElementById('otp').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('verifyBtn').click();
});

function showMessage(msg, type) {
    const msgDiv = document.getElementById('message');
    msgDiv.innerHTML = `<div class="message ${type}">${msg}</div>`;
    setTimeout(() => {
        msgDiv.innerHTML = '';
    }, 5000);
}

// Logout function (for dashboards)
function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}