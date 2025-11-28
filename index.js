        const firebaseConfig = {
            apiKey: "AIzaSyDhww9_LKlvEshuBiuoBVwzyGOzglgbgzw",
            authDomain: "controle-frequencia-460c8.firebaseapp.com",
            projectId: "controle-frequencia-460c8",
            storageBucket: "controle-frequencia-460c8.firebasestorage.app",
            messagingSenderId: "136216414571",
            appId: "1:136216414571:web:edc92bf478fcaa6445a42e"
        };

        // Inicializa o Firebase
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();

        // Elementos do DOM
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('login-error');
        const forgotPasswordLink = document.getElementById('forgot-password-link');


        // Redireciona se o usuário já estiver logado
        auth.onAuthStateChanged(user => {
            if (user) {
                window.location.href = 'ponto.html';
            }
        });

        // Lógica de Login
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const senha = document.getElementById('senha').value;
            loginError.style.display = 'none';

            auth.signInWithEmailAndPassword(email, senha)
                .then(userCredential => {
                    // O onAuthStateChanged vai lidar com o redirecionamento
                })
                .catch(error => {
                    console.error("Erro de login:", error);
                    loginError.style.display = 'block';
                });
        });

        // Lógica para "Esqueci minha senha"
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            if (!email) {
                alert("Por favor, digite seu e-mail no campo acima.");
                return;
            }
            auth.sendPasswordResetEmail(email)
                .then(() => {
                    alert("Link para redefinir sua senha enviado para o seu e-mail.");
                })
                .catch((error) => {
                    console.error("Erro ao enviar e-mail de redefinição:", error);
                    alert("Não foi possível enviar o e-mail de redefinição.");
                });
        });