(() => {
    const SUPABASE_URL = 'https://zcubzjiwvwbnzqmcbvjh.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qXIdxRZ4vG7voIYiYEwOzg_2qpxBC1C';
    const pageType = document.body.dataset.portalPage;
    const clientOptions = pageType === 'set-password'
        ? { auth: { detectSessionInUrl: false } }
        : undefined;

    if (!window.supabase?.createClient) {
        showMessage(document.querySelector('#login-message, #dashboard-message, #setup-message'), 'The student portal could not load. Check your connection and try again.', 'error');
        return;
    }

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, clientOptions);

    function showMessage(element, message, type = 'info') {
        if (!element) return;
        element.textContent = message;
        element.className = `portal-message${message ? ` is-${type}` : ''}`;
    }

    function setButtonLoading(button, loading, loadingText, idleText) {
        button.disabled = loading;
        button.textContent = loading ? loadingText : idleText;
    }

    function isPasswordRecoveryLink() {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const queryParams = new URLSearchParams(window.location.search);
        return hashParams.get('type') === 'recovery' || queryParams.get('type') === 'recovery';
    }

    function initializeLogin() {
        const loginPanel = document.querySelector('#login-panel');
        const recoveryPanel = document.querySelector('#recovery-panel');
        const loginForm = document.querySelector('#login-form');
        const emailInput = document.querySelector('#login-email');
        const loginMessage = document.querySelector('#login-message');
        const loginButton = document.querySelector('#login-submit');
        const forgotButton = document.querySelector('#forgot-password');
        const recoveryForm = document.querySelector('#recovery-form');
        const recoveryMessage = document.querySelector('#recovery-message');
        const recoveryButton = document.querySelector('#recovery-submit');

        function showRecoveryForm() {
            loginPanel.hidden = true;
            recoveryPanel.hidden = false;
        }

        client.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') showRecoveryForm();
        });

        if (isPasswordRecoveryLink()) {
            showRecoveryForm();
        } else {
            client.auth.getSession().then(({ data, error }) => {
                if (error) {
                    showMessage(loginMessage, 'Unable to check your session. Please try signing in again.', 'error');
                } else if (data.session) {
                    window.location.replace('student-dashboard.html');
                }
            });
        }

        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            showMessage(loginMessage, '');
            setButtonLoading(loginButton, true, 'Signing In...', 'Sign In');

            const { error } = await client.auth.signInWithPassword({
                email: emailInput.value.trim(),
                password: document.querySelector('#login-password').value
            });

            if (error) {
                const message = error.message === 'Invalid login credentials'
                    ? 'The email or password is incorrect. Please check your details and try again.'
                    : 'We could not sign you in. Please try again.';
                showMessage(loginMessage, message, 'error');
                setButtonLoading(loginButton, false, 'Signing In...', 'Sign In');
                return;
            }

            window.location.replace('student-dashboard.html');
        });

        forgotButton.addEventListener('click', async () => {
            showMessage(loginMessage, '');
            if (!emailInput.value.trim() || !emailInput.checkValidity()) {
                emailInput.focus();
                emailInput.reportValidity();
                showMessage(loginMessage, 'Enter your account email address to request a password reset.', 'error');
                return;
            }

            setButtonLoading(forgotButton, true, 'Sending...', 'Forgot password?');
            const redirectTo = new URL('student-set-password.html', window.location.href).href;
            const { error } = await client.auth.resetPasswordForEmail(emailInput.value.trim(), { redirectTo });
            setButtonLoading(forgotButton, false, 'Sending...', 'Forgot password?');

            if (error) {
                showMessage(loginMessage, 'We could not send a reset email right now. Please try again later.', 'error');
                return;
            }

            showMessage(loginMessage, 'If this email has a student account, a password reset link will be sent.', 'success');
        });

        recoveryForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            showMessage(recoveryMessage, '');
            const password = document.querySelector('#new-password').value;
            const confirmation = document.querySelector('#confirm-password').value;

            if (password.length < 12) {
                showMessage(recoveryMessage, 'Your password must be at least 12 characters long.', 'error');
                return;
            }

            if (password !== confirmation) {
                showMessage(recoveryMessage, 'The passwords do not match.', 'error');
                return;
            }

            setButtonLoading(recoveryButton, true, 'Updating...', 'Update Password');
            const { error } = await client.auth.updateUser({ password });
            if (error) {
                showMessage(recoveryMessage, 'We could not update your password. Request a new reset link and try again.', 'error');
                setButtonLoading(recoveryButton, false, 'Updating...', 'Update Password');
                return;
            }

            showMessage(recoveryMessage, 'Password updated. Opening your student portal...', 'success');
            window.setTimeout(() => window.location.replace('student-dashboard.html'), 800);
        });
    }

    async function initializeDashboard() {
        const dashboard = document.querySelector('#dashboard-content');
        const loading = document.querySelector('#dashboard-loading');
        const status = document.querySelector('#dashboard-message');
        const email = document.querySelector('#student-email');
        const signOutButton = document.querySelector('#sign-out');

        const { data, error } = await client.auth.getSession();
        if (error || !data.session) {
            window.location.replace('student-login.html');
            return;
        }

        email.textContent = data.session.user.email || 'Student';
        dashboard.hidden = false;
        loading.hidden = true;

        client.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') window.location.replace('student-login.html');
        });

        signOutButton.addEventListener('click', async () => {
            showMessage(status, '');
            setButtonLoading(signOutButton, true, 'Signing Out...', 'Sign Out');
            const { error: signOutError } = await client.auth.signOut();
            if (signOutError) {
                showMessage(status, 'Unable to sign out right now. Please try again.', 'error');
                setButtonLoading(signOutButton, false, 'Signing Out...', 'Sign Out');
                return;
            }
            window.location.replace('student-login.html');
        });
    }

    function readPasswordSetupCallback() {
        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const getParam = (name) => queryParams.get(name) || hashParams.get(name);
        const rawType = getParam('type');
        const type = rawType === 'invite' || rawType === 'recovery' ? rawType : null;

        return {
            type,
            code: queryParams.get('code') || hashParams.get('code'),
            tokenHash: getParam('token_hash'),
            accessToken: hashParams.get('access_token'),
            refreshToken: hashParams.get('refresh_token'),
            errorCode: getParam('error_code') || getParam('error'),
            errorDescription: getParam('error_description'),
            hasAuthParams: ['type', 'code', 'token_hash', 'access_token', 'refresh_token', 'error_code', 'error', 'error_description']
                .some((param) => getParam(param))
        };
    }

    function showPasswordSetupError(messageElement, code, description) {
        const details = `${code || ''} ${description || ''}`.toLowerCase();
        const message = /expired|invalid|otp|token/.test(details)
            ? 'This invitation or password recovery link has expired or is invalid. Ask Marigold to resend your invitation or request a new password reset link.'
            : 'We could not verify this invitation or password recovery link. Open the latest link from your email or request a new one.';
        showMessage(messageElement, message, 'error');
    }

    async function initializePasswordSetup() {
        const form = document.querySelector('#password-setup-form');
        const message = document.querySelector('#setup-message');
        const successPanel = document.querySelector('#password-setup-success');
        const submitButton = document.querySelector('#password-setup-submit');
        const callback = readPasswordSetupCallback();

        if (callback.hasAuthParams) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (callback.errorCode || callback.errorDescription) {
            showPasswordSetupError(message, callback.errorCode, callback.errorDescription);
            return;
        }

        if (!callback.type || (!callback.code && !callback.tokenHash && !(callback.accessToken && callback.refreshToken))) {
            showMessage(message, 'Open this page from a valid student invitation or password recovery link to set your password.', 'error');
            return;
        }

        let result;
        if (callback.tokenHash) {
            result = await client.auth.verifyOtp({ token_hash: callback.tokenHash, type: callback.type });
        } else if (callback.accessToken && callback.refreshToken) {
            result = await client.auth.setSession({
                access_token: callback.accessToken,
                refresh_token: callback.refreshToken
            });
        } else {
            result = await client.auth.exchangeCodeForSession(callback.code);
        }

        if (result.error || !result.data?.session?.user) {
            showPasswordSetupError(message, result.error?.code || result.error?.name, result.error?.message);
            return;
        }

        showMessage(message, 'Secure link verified. Choose a password with at least 12 characters.', 'success');
        form.hidden = false;

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            showMessage(message, '');

            const password = document.querySelector('#setup-password').value;
            const confirmation = document.querySelector('#setup-password-confirm').value;

            if (password.length < 12) {
                showMessage(message, 'Your password must be at least 12 characters long.', 'error');
                return;
            }

            if (password !== confirmation) {
                showMessage(message, 'The passwords do not match.', 'error');
                return;
            }

            setButtonLoading(submitButton, true, 'Setting Password...', 'Set Password');
            const { error } = await client.auth.updateUser({ password });

            if (error) {
                showMessage(message, 'We could not update your password. The link may have expired; request a new one and try again.', 'error');
                setButtonLoading(submitButton, false, 'Setting Password...', 'Set Password');
                return;
            }

            await client.auth.signOut({ scope: 'local' });
            form.hidden = true;
            message.hidden = true;
            successPanel.hidden = false;
        });
    }

    if (pageType === 'login') initializeLogin();
    if (pageType === 'dashboard') initializeDashboard();
    if (pageType === 'set-password') {
        initializePasswordSetup().catch(() => {
            showMessage(document.querySelector('#setup-message'), 'We could not verify this invitation or password recovery link. Open the latest link from your email or request a new one.', 'error');
        });
    }
})();
