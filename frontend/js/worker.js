const API_URL = 'http://localhost:5000/api';
const token = localStorage.getItem('token');
const userType = localStorage.getItem('userType');

if (!token || userType !== 'worker') {
    window.location.href = 'index.html';
}

// ========== TAB SWITCHING - FIXED ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Remove active class from all tabs
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        // Add active class to clicked tab
        this.classList.add('active');
        
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Show selected tab content
        const tabId = this.dataset.tab;
        document.getElementById(`${tabId}Tab`).classList.add('active');
        
        // Refresh data when switching tabs
        if (tabId === 'active') loadActiveJobs();
        if (tabId === 'completed') loadCompletedJobs();
        if (tabId === 'applications') loadApplications();
        if (tabId === 'profile') loadProfileData();
    });
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

// Load Profile Stats
async function loadProfile() {
    try {
        const res = await fetch(`${API_URL}/workers/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        document.getElementById('userName').textContent = data.name || 'Worker';
        document.getElementById('jobCount').textContent = data.completed_jobs_count || 0;
        document.getElementById('earnings').textContent = data.total_earnings || 0;
        document.getElementById('rating').textContent = data.rating || 0;
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Load Profile Data for Edit
async function loadProfileData() {
    try {
        const res = await fetch(`${API_URL}/workers/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        document.getElementById('profileName').value = data.name || '';
        document.getElementById('profileSkills').value = data.skills || '';
        document.getElementById('profileExp').value = data.experience_years || 0;
        
        const badgesDiv = document.getElementById('badgesList');
        if (data.badges && data.badges.length > 0) {
            badgesDiv.innerHTML = '<h4>🏆 My Badges</h4>' + data.badges.map(b => `<span class="badge">🏆 ${b.name}</span>`).join('');
        } else {
            badgesDiv.innerHTML = '<p>⭐ Complete jobs to earn badges!</p>';
        }
    } catch (error) {
        console.error('Error loading profile data:', error);
    }
}

// Update Profile
document.getElementById('updateProfileBtn')?.addEventListener('click', async () => {
    const data = {
        name: document.getElementById('profileName').value,
        skills: document.getElementById('profileSkills').value,
        experience_years: parseInt(document.getElementById('profileExp').value) || 0,
        looking_for_work: true
    };
    
    try {
        const res = await fetch(`${API_URL}/workers/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showMessage('✅ Profile updated successfully!', 'success');
            loadProfile();
        } else {
            showMessage('❌ Failed to update profile', 'error');
        }
    } catch (error) {
        showMessage('❌ Error updating profile', 'error');
    }
});

// Search Jobs
async function searchJobs() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        showMessage('🔍 Please enter a job type to search', 'info');
        return;
    }
    
    document.getElementById('searchStatus').innerHTML = '🔍 Searching...';
    document.getElementById('searchResults').innerHTML = '<div class="loading">⏳ Loading jobs...</div>';
    
    try {
        const res = await fetch(`${API_URL}/jobs/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ query })
        });
        const jobs = await res.json();
        
        if (jobs.length === 0) {
            document.getElementById('searchResults').innerHTML = '<div class="job-card">😕 No jobs found. Try "plumbing", "cooking", or "driving"</div>';
            document.getElementById('searchStatus').innerHTML = '❌ No results found';
        } else {
            let html = '<h3 style="margin-bottom:15px">📋 Search Results</h3>';
            jobs.forEach(job => {
                html += `
                    <div class="job-card">
                        <div class="job-title">${escapeHtml(job.title)}</div>
                        <div class="job-description">${escapeHtml(job.description || 'No description')}</div>
                        <div class="job-wage">💰 ₹${job.wage} per ${job.wage_type}</div>
                        <div>📍 ${escapeHtml(job.address_text || 'Location not specified')}</div>
                        <button class="apply-btn" onclick="applyForJob(${job.id})">📝 Apply Now</button>
                    </div>
                `;
            });
            document.getElementById('searchResults').innerHTML = html;
            document.getElementById('searchStatus').innerHTML = `✅ Found ${jobs.length} job(s)`;
        }
    } catch (error) {
        document.getElementById('searchResults').innerHTML = '<div class="job-card">❌ Error searching jobs</div>';
        document.getElementById('searchStatus').innerHTML = '❌ Search failed';
    }
}

// Apply for Job
window.applyForJob = async (jobId) => {
    const experience = prompt('Tell about your experience (e.g., "5 years plumbing experience"):');
    if (!experience || experience.trim() === '') return;
    
    showMessage('📝 Submitting application...', 'info');
    
    try {
        const res = await fetch(`${API_URL}/jobs/${jobId}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ application_type: 'text', text_experience: experience })
        });
        const data = await res.json();
        
        if (data.success) {
            showMessage('✅ Application submitted successfully!', 'success');
            loadApplications();
            document.getElementById('searchResults').innerHTML = '';
            document.getElementById('searchInput').value = '';
        } else {
            showMessage('❌ ' + (data.error || 'Failed to apply'), 'error');
        }
    } catch (error) {
        showMessage('❌ Error applying for job', 'error');
    }
};

// Load Active Jobs
async function loadActiveJobs() {
    const container = document.getElementById('activeJobsList');
    if (!container) return;
    container.innerHTML = '<div class="loading">⏳ Loading...</div>';
    
    try {
        const res = await fetch(`${API_URL}/workers/active-jobs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const jobs = await res.json();
        
        if (jobs.length === 0) {
            container.innerHTML = '<div class="job-card">📋 No active jobs. Apply for jobs to get started!</div>';
            return;
        }
        
        let html = '';
        jobs.forEach(job => {
            html += `
                <div class="job-card">
                    <div class="job-title">${escapeHtml(job.title)}</div>
                    <div class="job-wage">💰 ₹${job.wage} per ${job.wage_type}</div>
                    <div>👤 Employer: ${escapeHtml(job.employer_name)}</div>
                    <div>📍 ${escapeHtml(job.address_text || 'No location')}</div>
                    <button class="complete-btn" onclick="completeJob(${job.id})">✅ Mark as Complete</button>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div class="job-card">❌ Error loading active jobs</div>';
    }
}

// Complete Job
window.completeJob = async (assignmentId) => {
    if (!confirm('✅ Mark this job as completed?')) return;
    
    showMessage('📝 Marking job as completed...', 'info');
    
    try {
        const res = await fetch(`${API_URL}/workers/complete-job/${assignmentId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
            showMessage('🎉 Congratulations! Job completed!', 'success');
            loadActiveJobs();
            loadCompletedJobs();
            loadProfile();
        } else {
            showMessage('❌ Failed to complete job', 'error');
        }
    } catch (error) {
        showMessage('❌ Error completing job', 'error');
    }
};

// Load Completed Jobs
async function loadCompletedJobs() {
    const container = document.getElementById('completedJobsList');
    if (!container) return;
    container.innerHTML = '<div class="loading">⏳ Loading...</div>';
    
    try {
        const res = await fetch(`${API_URL}/workers/completed-jobs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const jobs = await res.json();
        
        if (jobs.length === 0) {
            container.innerHTML = '<div class="job-card">✅ No completed jobs yet.</div>';
            return;
        }
        
        let html = '';
        jobs.forEach(job => {
            const ratingStars = job.employer_rating ? '★'.repeat(job.employer_rating) + '☆'.repeat(5 - job.employer_rating) : 'Pending';
            html += `
                <div class="job-card">
                    <div class="job-title">✅ ${escapeHtml(job.job_title)}</div>
                    <div class="job-wage">💰 ₹${job.payment_amount || job.wage}</div>
                    <div>👤 Employer: ${escapeHtml(job.employer_name)}</div>
                    <div>📅 Completed: ${new Date(job.completed_at).toLocaleDateString()}</div>
                    <div>⭐ Rating: ${ratingStars}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div class="job-card">❌ Error loading completed jobs</div>';
    }
}

// Load Applications
async function loadApplications() {
    const container = document.getElementById('applicationsList');
    if (!container) return;
    container.innerHTML = '<div class="loading">⏳ Loading...</div>';
    
    try {
        const res = await fetch(`${API_URL}/jobs/worker/applications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const apps = await res.json();
        
        if (apps.length === 0) {
            container.innerHTML = '<div class="job-card">📝 No applications yet. Search and apply for jobs!</div>';
            return;
        }
        
        let html = '';
        apps.forEach(app => {
            let statusColor = app.status === 'pending' ? 'orange' : (app.status === 'accepted' ? 'green' : 'red');
            let statusIcon = app.status === 'pending' ? '⏳' : (app.status === 'accepted' ? '✅' : '❌');
            
            html += `
                <div class="job-card">
                    <div class="job-title">${escapeHtml(app.title)}</div>
                    <div class="job-wage">💰 ₹${app.wage} per ${app.wage_type}</div>
                    <div>Status: <span style="color:${statusColor}; font-weight:bold">${statusIcon} ${app.status.toUpperCase()}</span></div>
                    <div>📅 Applied: ${new Date(app.applied_at).toLocaleDateString()}</div>
                    <div>💬 Your Experience: ${escapeHtml(app.text_experience || 'Not provided')}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<div class="job-card">❌ Error loading applications</div>';
    }
}

// Voice Search
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    
    document.getElementById('voiceBtn').addEventListener('click', () => {
        recognition.start();
        document.getElementById('voiceBtn').style.transform = 'scale(0.98)';
        document.getElementById('searchStatus').innerHTML = '🎤 Listening... Speak your job type';
        setTimeout(() => {
            document.getElementById('voiceBtn').style.transform = '';
        }, 200);
    });
    
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        document.getElementById('searchInput').value = text;
        document.getElementById('searchStatus').innerHTML = `🎤 You said: "${text}"`;
        searchJobs();
    };
    
    recognition.onerror = () => {
        document.getElementById('searchStatus').innerHTML = '🎤 Voice not recognized. Please type.';
    };
} else {
    document.getElementById('voiceBtn').style.display = 'none';
}

// Event Listeners
document.getElementById('searchBtn').addEventListener('click', searchJobs);
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchJobs();
});

// Helper Functions
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showMessage(msg, type) {
    const msgDiv = document.getElementById('message');
    msgDiv.innerHTML = `<div class="message ${type}">${msg}</div>`;
    setTimeout(() => {
        msgDiv.innerHTML = '';
    }, 4000);
}

// Initialize all
loadProfile();
loadActiveJobs();
loadCompletedJobs();
loadApplications();