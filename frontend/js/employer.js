const API_URL = 'http://localhost:5000/api';
const token = localStorage.getItem('token');
const userType = localStorage.getItem('userType');

if (!token || userType !== 'employer') {
    window.location.href = 'index.html';
}

let selectedRatings = {};

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const tabId = this.dataset.tab;
        document.getElementById(`${tabId}Tab`).classList.add('active');
        
        if (tabId === 'applications') loadApplications();
        if (tabId === 'hired') loadHiredWorkers();
        if (tabId === 'rate') loadRateList();
    });
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

// Load Profile
async function loadProfile() {
    try {
        const res = await fetch(`${API_URL}/employers/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        document.getElementById('jobsPosted').innerText = data.total_jobs_posted || 0;
        document.getElementById('workersHired').innerText = data.total_workers_hired || 0;
        document.getElementById('companyName').innerText = data.company_name || data.name || 'Employer';
    } catch (error) {
        console.error(error);
    }
}

// Post Job
document.getElementById('postJobBtn').addEventListener('click', async () => {
    const title = document.getElementById('jobTitle').value.trim();
    const wage = document.getElementById('jobWage').value;
    const contactPerson = document.getElementById('contactPerson').value.trim();
    const contactPhone = document.getElementById('contactPhone').value.trim();
    
    if (!title) {
        showPostMessage('❌ Please enter job title', 'error');
        return;
    }
    if (!wage || wage <= 0) {
        showPostMessage('❌ Please enter valid wage amount', 'error');
        return;
    }
    if (!contactPerson) {
        showPostMessage('❌ Please enter contact person name', 'error');
        return;
    }
    if (!contactPhone || contactPhone.length < 10) {
        showPostMessage('❌ Please enter valid contact phone number', 'error');
        return;
    }
    
    const jobData = {
        title: title,
        description: document.getElementById('jobDesc').value,
        skills_required: document.getElementById('jobSkills').value,
        wage: parseFloat(wage),
        wage_type: document.getElementById('wageType').value,
        address_text: document.getElementById('jobAddress').value,
        contact_person: contactPerson,
        contact_phone: contactPhone
    };
    
    const btn = document.getElementById('postJobBtn');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Posting...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`${API_URL}/jobs/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(jobData)
        });
        const data = await res.json();
        
        if (data.success) {
            showPostMessage('✅ Job posted successfully!', 'success');
            document.getElementById('jobTitle').value = '';
            document.getElementById('jobDesc').value = '';
            document.getElementById('jobSkills').value = '';
            document.getElementById('jobWage').value = '';
            document.getElementById('jobAddress').value = '';
            document.getElementById('contactPerson').value = '';
            document.getElementById('contactPhone').value = '';
            loadMyJobs();
            loadProfile();
        } else {
            showPostMessage('❌ Failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showPostMessage('❌ Error posting job. Make sure backend is running.', 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

function showPostMessage(msg, type) {
    const msgDiv = document.getElementById('postMessage');
    msgDiv.innerHTML = `<div class="message ${type}" style="padding: 8px; border-radius: 8px;">${msg}</div>`;
    setTimeout(() => msgDiv.innerHTML = '', 4000);
}

// Load My Jobs
async function loadMyJobs() {
    const container = document.getElementById('myJobs');
    container.innerHTML = '<div class="loading">⏳ Loading...</div>';
    
    try {
        const res = await fetch(`${API_URL}/jobs/employer/my-jobs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const jobs = await res.json();
        
        if (jobs.length === 0) {
            container.innerHTML = '<div class="job-card">📋 No jobs posted yet</div>';
            return;
        }
        
        let html = '';
        jobs.forEach(job => {
            let statusColor = job.status === 'open' ? '#27ae60' : (job.status === 'in_progress' ? '#f39c12' : '#999');
            html += `
                <div class="job-card">
                    <div class="job-title">${escapeHtml(job.title)}</div>
                    <div class="job-wage">💰 ₹${job.wage} per ${job.wage_type}</div>
                    <div>📍 ${escapeHtml(job.address_text || 'No location')}</div>
                    <div>📞 Contact: ${escapeHtml(job.contact_person || 'N/A')} (${job.contact_phone || 'N/A'})</div>
                    <div>Status: <span style="color:${statusColor}; font-weight:bold">${job.status.toUpperCase()}</span></div>
                    <div>📝 Applications: ${job.application_count || 0}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div class="job-card">❌ Error loading jobs</div>';
    }
}

// Load Applications
async function loadApplications() {
    const container = document.getElementById('applicationsList');
    container.innerHTML = '<div class="loading">⏳ Loading...</div>';
    
    try {
        const res = await fetch(`${API_URL}/jobs/employer/applications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const apps = await res.json();
        
        if (apps.length === 0) {
            container.innerHTML = '<div class="job-card">📝 No pending applications</div>';
            return;
        }
        
        let html = '';
        apps.forEach(app => {
            html += `
                <div class="job-card">
                    <div class="job-title">${escapeHtml(app.job_title)}</div>
                    <div>👤 Worker: ${escapeHtml(app.worker_name)}</div>
                    <div>📱 Phone: ${app.worker_phone}</div>
                    <div>⭐ Rating: ${app.worker_rating || 'New'}/5</div>
                    <div>💬 Experience: ${escapeHtml(app.text_experience || 'Not provided')}</div>
                    <div>📅 Applied: ${new Date(app.applied_at).toLocaleDateString()}</div>
                    <div style="margin-top: 15px;">
                        <button class="accept-btn" onclick="handleApplication(${app.id}, 'accept')">✅ Accept</button>
                        <button class="reject-btn" onclick="handleApplication(${app.id}, 'reject')">❌ Reject</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div class="job-card">❌ Error loading applications</div>';
    }
}

window.handleApplication = async (applicationId, action) => {
    if (!confirm(`Are you sure you want to ${action} this application?`)) return;
    
    try {
        const res = await fetch(`${API_URL}/jobs/applications/${applicationId}/${action}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
            showMessage(`✅ Application ${action}ed!`, 'success');
            loadApplications();
            loadMyJobs();
            loadHiredWorkers();
            loadProfile();
        } else {
            showMessage('❌ Failed', 'error');
        }
    } catch (error) {
        showMessage('❌ Error', 'error');
    }
};

// Load Hired Workers
async function loadHiredWorkers() {
    const container = document.getElementById('hiredList');
    container.innerHTML = '<div class="loading">⏳ Loading...</div>';
    
    try {
        const res = await fetch(`${API_URL}/jobs/employer/hired-workers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const workers = await res.json();
        
        if (workers.length === 0) {
            container.innerHTML = '<div class="job-card">👥 No workers hired yet</div>';
            return;
        }
        
        let html = '';
        workers.forEach(worker => {
            let ratingStars = worker.rating ? '★'.repeat(Math.round(worker.rating)) + '☆'.repeat(5 - Math.round(worker.rating)) : 'Not rated';
            html += `
                <div class="job-card">
                    <div class="job-title">${escapeHtml(worker.name)}</div>
                    <div>📱 ${worker.phone}</div>
                    <div>⭐ Rating: ${worker.rating || '0.0'} ${ratingStars}</div>
                    <div>💼 Job: ${escapeHtml(worker.job_title)}</div>
                    <div>📊 Status: ${worker.status}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div class="job-card">❌ Error loading hired workers</div>';
    }
}

// Load Rate List
async function loadRateList() {
    const container = document.getElementById('rateList');
    container.innerHTML = '<div class="loading">⏳ Loading...</div>';
    
    try {
        const res = await fetch(`${API_URL}/jobs/employer/completed-jobs-for-rating`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const jobs = await res.json();
        
        if (jobs.length === 0) {
            container.innerHTML = '<div class="job-card">⭐ No completed jobs to rate</div>';
            return;
        }
        
        let html = '';
        jobs.forEach(job => {
            html += `
                <div class="job-card">
                    <div class="job-title">${escapeHtml(job.job_title)}</div>
                    <div>👤 Worker: ${escapeHtml(job.worker_name)}</div>
                    <div>✅ Completed: ${new Date(job.completed_at).toLocaleDateString()}</div>
                    <div class="rating" id="rating-${job.id}" style="margin: 10px 0;">
                        ${[1,2,3,4,5].map(star => `<button class="star" onclick="setRating(${job.id}, ${star})">★</button>`).join('')}
                    </div>
                    <button onclick="submitRating(${job.id})" class="btn-primary" style="width:auto; padding:10px 20px;">Submit Rating</button>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div class="job-card">❌ Error loading</div>';
    }
}

window.setRating = (assignmentId, rating) => {
    selectedRatings[assignmentId] = rating;
    const stars = document.querySelectorAll(`#rating-${assignmentId} .star`);
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('selected');
        } else {
            star.classList.remove('selected');
        }
    });
};

window.submitRating = async (assignmentId) => {
    const rating = selectedRatings[assignmentId];
    if (!rating) {
        alert('Please select a rating first');
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/jobs/rate-worker`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ assignmentId, rating })
        });
        const data = await res.json();
        if (data.success) {
            showMessage('✅ Rating submitted successfully!', 'success');
            loadRateList();
            loadHiredWorkers();
        } else {
            showMessage('❌ Failed to submit rating', 'error');
        }
    } catch (error) {
        showMessage('❌ Error submitting rating', 'error');
    }
};

function showMessage(msg, type) {
    const msgDiv = document.getElementById('message');
    msgDiv.innerHTML = `<div class="message ${type}">${msg}</div>`;
    setTimeout(() => msgDiv.innerHTML = '', 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Initialize
loadProfile();
loadMyJobs();