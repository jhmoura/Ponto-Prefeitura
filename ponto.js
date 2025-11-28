
        // COLE AQUI A CONFIGURAÇÃO DO SEU FIREBASE
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
        const db = firebase.firestore();

        // Elementos do DOM
        const userEmail = document.getElementById('user-email');
        const currentDateEl = document.getElementById('current-date');
        const registrosTableBody = document.querySelector('#registros-table tbody');
        const logoutButton = document.getElementById('logout-button');
        const btnEntrada = document.getElementById('btn-entrada');
        const btnInicioIntervalo = document.getElementById('btn-inicio-intervalo');
        const btnFimIntervalo = document.getElementById('btn-fim-intervalo');
        const btnSaida = document.getElementById('btn-saida');
        const btnChangePassword = document.getElementById('btn-change-password');
        const btnDashboard = document.getElementById('btn-dashboard');

        // Verifica o estado da autenticação
        auth.onAuthStateChanged(async user => {
            if (user) {
                userEmail.textContent = user.email;
                currentDateEl.textContent = new Date().toLocaleDateString('pt-BR');
                carregarRegistrosDoDia(user.uid);

                // Verifica se o usuário é administrador
                try {
                    const userDoc = await db.collection('usuarios').doc(user.uid).get();
                    if (userDoc.exists && userDoc.data().administrador === true) {
                        btnDashboard.style.display = 'block';
                    }
                } catch (error) {
                    console.error("Erro ao verificar permissões de administrador:", error);
                }

            } else {
                window.location.href = 'index.html';
            }
        });

        // Lógica de Logout
        logoutButton.addEventListener('click', () => auth.signOut());

        // Lógica para alterar senha
        btnChangePassword.addEventListener('click', () => {
            const newPassword = prompt("Digite sua nova senha (mínimo de 6 caracteres):");
            if (newPassword && newPassword.length >= 6) {
                auth.currentUser.updatePassword(newPassword)
                    .then(() => {
                        alert("Senha alterada com sucesso!");
                    })
                    .catch(error => {
                        console.error("Erro ao alterar senha:", error);
                        alert("Ocorreu um erro ao alterar a senha. Tente fazer login novamente e repetir o processo.");
                    });
            } else if (newPassword) {
                alert("A senha precisa ter no mínimo 6 caracteres.");
            }
        });
        
        // Lógica para acessar o dashboard
        btnDashboard.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });

        // --- LÓGICA DO BANCO DE DADOS (FIRESTORE) ---

        btnEntrada.addEventListener('click', () => registrarPonto('Entrada'));
        btnInicioIntervalo.addEventListener('click', () => registrarPonto('Início do Intervalo'));
        btnFimIntervalo.addEventListener('click', () => registrarPonto('Fim do Intervalo'));
        btnSaida.addEventListener('click', () => registrarPonto('Saída'));

        async function registrarPonto(tipo) {
            const user = auth.currentUser;
            if (!user) return;
            document.querySelectorAll('#registro-container button:not(#logout-button)').forEach(b => b.disabled = true);
            try {
                await db.collection('registros').add({
                    uid: user.uid,
                    tipo: tipo,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                await carregarRegistrosDoDia(user.uid);
            } catch (error) {
                console.error("Erro ao registrar ponto: ", error);
                alert("Ocorreu um erro ao registrar o ponto. Tente novamente.");
            }
        }
        
        async function carregarRegistrosDoDia(uid) {
            registrosTableBody.innerHTML = '';
            const hoje = new Date();
            const inicioDoDia = new Date(hoje.setHours(0, 0, 0, 0));
            const fimDoDia = new Date(hoje.setHours(23, 59, 59, 999));
            const query = db.collection('registros').where('uid', '==', uid).where('timestamp', '>=', inicioDoDia).where('timestamp', '<=', fimDoDia).orderBy('timestamp', 'asc');
            try {
                const snapshot = await query.get();
                const registrosDoDia = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const registro = { tipo: data.tipo, hora: data.timestamp.toDate().toLocaleTimeString('pt-BR') };
                    adicionarRegistroNaTabela(registro);
                    registrosDoDia.push(registro);
                });
                atualizarEstadoBotoes(registrosDoDia);
            } catch (error) {
                console.error("Erro ao carregar registros:", error);
            }
        }

        function adicionarRegistroNaTabela({ tipo, hora }) {
            const row = registrosTableBody.insertRow();
            row.insertCell(0).textContent = tipo;
            row.insertCell(1).textContent = hora;
        }

        function atualizarEstadoBotoes(registros) {
            const temEntrada = registros.some(r => r.tipo === 'Entrada');
            const temInicioIntervalo = registros.some(r => r.tipo === 'Início do Intervalo');
            const temFimIntervalo = registros.some(r => r.tipo === 'Fim do Intervalo');
            const temSaida = registros.some(r => r.tipo === 'Saída');
            btnEntrada.disabled = temEntrada;
            btnInicioIntervalo.disabled = !temEntrada || temInicioIntervalo;
            btnFimIntervalo.disabled = !temInicioIntervalo || temFimIntervalo;
            btnSaida.disabled = !temEntrada || temSaida || (temInicioIntervalo && !temFimIntervalo);
        }
    