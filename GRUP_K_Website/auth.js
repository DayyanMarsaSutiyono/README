// Auth Management Functions
function checkAuth(requiredUserType = null) {
    const userType = localStorage.getItem('userType');
    const loginTime = localStorage.getItem('loginTime');

    if (!userType) {
        window.location.href = 'login.html';
        return false;
    }

    if (requiredUserType && userType !== requiredUserType) {
        alert('Anda tidak memiliki akses ke halaman ini!');
        logoutUser();
        return false;
    }

    return true;
}

function getCurrentUser() {
    return {
        type: localStorage.getItem('userType'),
        email: localStorage.getItem('userEmail'),
        nopol: localStorage.getItem('userNopol'),
        loginTime: localStorage.getItem('loginTime')
    };
}

function logoutUser() {
    localStorage.removeItem('userType');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userNopol');
    localStorage.removeItem('loginTime');
    window.location.href = 'login.html';
}

function updateUserInfo() {
    const user = getCurrentUser();
    const userInfoEl = document.getElementById('userInfo');
    
    if (userInfoEl) {
        const userTypeDisplay = user.type === 'sopir' ? '🚗 Sopir' : '👥 Masyarakat Umum';
        userInfoEl.innerHTML = `
            <span class="user-badge">${userTypeDisplay}</span>
            <span class="user-email">${user.email}</span>
        `;
    }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    updateUserInfo();
});
