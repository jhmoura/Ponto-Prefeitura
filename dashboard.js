const firebaseConfig = {
        apiKey: "AIzaSyDhww9_LKlvEshuBiuoBVwzyGOzglgbgzw",
        authDomain: "controle-frequencia-460c8.firebaseapp.com",
        projectId: "controle-frequencia-460c8",
        storageBucket: "controle-frequencia-460c8.firebasestorage.app",
        messagingSenderId: "136216414571",
        appId: "1:136216414571:web:edc92bf478fcaa6445a42e"
    };

    const app = firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- LÓGICA GERAL E DE NAVEGAÇÃO ---
    const tabRelatorios = document.getElementById('tab-relatorios');
    const tabUsuarios = document.getElementById('tab-usuarios');
    const contentRelatorios = document.getElementById('content-relatorios');
    const contentUsuarios = document.getElementById('content-usuarios');

    tabRelatorios.addEventListener('click', () => {
        tabRelatorios.classList.add('active');
        tabUsuarios.classList.remove('active');
        contentRelatorios.classList.remove('hidden');
        contentUsuarios.classList.add('hidden');
    });

    tabUsuarios.addEventListener('click', () => {
        tabUsuarios.classList.add('active');
        tabRelatorios.classList.remove('active');
        contentUsuarios.classList.remove('hidden');
        contentRelatorios.classList.add('hidden');
    });

    document.getElementById('logout-button').addEventListener('click', () => auth.signOut());

    // --- LÓGICA DA ABA DE RELATÓRIOS ---
    let allConsolidatedRecords = [];
    let filteredRecords = [];
    let secretariasData = [];

    const loaderRelatorios = document.getElementById('loader-relatorios');
    const dataTable = document.getElementById('dataTable');
    const tableBody = document.getElementById('tableBody');
    const messageRelatorios = document.getElementById('message-relatorios');
    const recordCount = document.getElementById('recordCount');
    const applyFilterBtn = document.getElementById('applyFilter');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const exportPdfBtn = document.getElementById('exportPdf');
    const exportCsvBtn = document.getElementById('exportCsv');
    const secretariaFilter = document.getElementById('secretariaFilter');
    const setorFilter = document.getElementById('setorFilter');

    async function loadFilterOptions() {
        try {
            const querySnapshot = await db.collection("secretarias").get();
            secretariasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            secretariaFilter.innerHTML = '<option value="">Todas as Secretarias</option>';
            document.getElementById('secretaria-cadastro').innerHTML = '<option value="">Selecione uma secretaria</option>';
            
            secretariasData.sort((a, b) => a.nome.localeCompare(b.nome));

            secretariasData.forEach(secretaria => {
                const optionRelatorio = document.createElement('option');
                optionRelatorio.value = secretaria.nome;
                optionRelatorio.textContent = secretaria.nome;
                secretariaFilter.appendChild(optionRelatorio);

                const optionCadastro = document.createElement('option');
                optionCadastro.value = secretaria.id;
                optionCadastro.textContent = secretaria.nome;
                document.getElementById('secretaria-cadastro').appendChild(optionCadastro);
            });
        } catch (error) {
            console.error("Erro ao carregar secretarias para os filtros: ", error);
        }
    }

    function populateSetorFilter() {
        const secretariaNome = secretariaFilter.value;
        setorFilter.innerHTML = '<option value="">Todos os Setores</option>';
        if (secretariaNome) {
            const secretaria = secretariasData.find(s => s.nome === secretariaNome);
            if (secretaria && secretaria.setores) {
                secretaria.setores.sort().forEach(setor => {
                    const option = document.createElement('option');
                    option.value = setor;
                    option.textContent = setor;
                    setorFilter.appendChild(option);
                });
            }
        }
    }

    async function fetchData() {
        loaderRelatorios.style.display = 'flex';
        try {
            const usersSnapshot = await db.collection('usuarios').get();
            const usersMap = new Map();
            usersSnapshot.forEach(doc => usersMap.set(doc.id, doc.data()));

            const recordsSnapshot = await db.collection('registros').orderBy('timestamp', 'desc').get();
            const rawRecords = recordsSnapshot.docs.map(doc => doc.data());

            const groupedRecords = groupRecordsByUserAndDate(rawRecords, usersMap);
            allConsolidatedRecords = Object.values(groupedRecords);
            applyFilters();

        } catch (error) {
            console.error("Erro ao buscar dados: ", error);
            messageRelatorios.querySelector('p').textContent = "Erro ao carregar dados.";
            messageRelatorios.classList.remove('hidden');
        } finally {
            loaderRelatorios.style.display = 'none';
        }
    }

    function groupRecordsByUserAndDate(records, users) {
        const grouped = {};
        records.forEach(record => {
            if (!record.timestamp || !record.uid) return;
            const userDetails = users.get(record.uid);
            if (!userDetails) return;

            const dateKey = record.timestamp.toDate().toISOString().split('T')[0];
            const groupKey = `${record.uid}_${dateKey}`;

            if (!grouped[groupKey]) {
                grouped[groupKey] = { ...userDetails, uid: record.uid, data: dateKey, Entrada: null, 'Início do Intervalo': null, 'Fim do Intervalo': null, Saída: null };
            }
            if (record.tipo && grouped[groupKey][record.tipo] === null) {
                grouped[groupKey][record.tipo] = record.timestamp;
            }
        });
        return grouped;
    }

    function applyFilters() {
        const filters = {
            start: document.getElementById('startDate').value,
            end: document.getElementById('endDate').value,
            nome: document.getElementById('nomeFilter').value.toLowerCase(),
            secretaria: secretariaFilter.value,
            setor: setorFilter.value,
            cargo: document.getElementById('cargoFilter').value.toLowerCase()
        };

        filteredRecords = allConsolidatedRecords.filter(r => 
            (!filters.start || r.data >= filters.start) &&
            (!filters.end || r.data <= filters.end) &&
            (!filters.nome || r.nome.toLowerCase().includes(filters.nome)) &&
            (!filters.secretaria || r.secretaria === filters.secretaria) &&
            (!filters.setor || r.setor === filters.setor) &&
            (!filters.cargo || r.cargo.toLowerCase().includes(filters.cargo))
        );
        renderTable(filteredRecords);
    }

    function renderTable(records) {
        tableBody.innerHTML = '';
        if (records.length === 0) {
            messageRelatorios.classList.remove('hidden');
            dataTable.classList.add('hidden');
            exportPdfBtn.disabled = true; exportCsvBtn.disabled = true;
            return;
        }
        
        dataTable.classList.remove('hidden');
        messageRelatorios.classList.add('hidden');
        exportPdfBtn.disabled = false; exportCsvBtn.disabled = false;

        records.forEach(r => {
            const tr = document.createElement('tr');
            const workedHours = calculateWorkedHours(r);
            tr.innerHTML = `
                <td class="px-6 py-4 text-sm font-medium text-gray-900">${r.nome}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${r.matricula}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${formatDate(r.data)}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${formatTime(r['Entrada'])}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${formatTime(r['Saída'])}</td>
                <td class="px-6 py-4 text-sm font-semibold">${workedHours > 0 ? workedHours.toFixed(2).replace('.', ',') + 'h' : '---'}</td>
            `;
            tableBody.appendChild(tr);
        });
        recordCount.textContent = records.length;
    }

    function exportToPDF() {
        if (filteredRecords.length === 0) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("Relatório de Ponto", 14, 16);
        
        const head = [["Nome", "Matrícula", "Secretaria", "Setor", "Data", "Entrada", "Saída", "Horas Trab."]];
        const body = filteredRecords.map(r => [
            r.nome, r.matricula, r.secretaria, r.setor, formatDate(r.data), formatTime(r['Entrada']),
            formatTime(r['Saída']), (calculateWorkedHours(r) > 0 ? calculateWorkedHours(r).toFixed(2).replace('.', ',') + 'h' : '---')
        ]);
        doc.autoTable({ head, body, startY: 25 });
        doc.save(`relatorio_ponto_${new Date().toISOString().slice(0,10)}.pdf`);
    }

    function exportToCSV() {
        if (filteredRecords.length === 0) return;
        const data = filteredRecords.map(r => ({
            Nome: r.nome, Matrícula: r.matricula, Secretaria: r.secretaria, Setor: r.setor, Cargo: r.cargo,
            Data: formatDate(r.data), Entrada: formatTime(r['Entrada']), Inicio_Intervalo: formatTime(r['Início do Intervalo']),
            Fim_Intervalo: formatTime(r['Fim do Intervalo']), Saida: formatTime(r['Saída']),
            Horas_Trabalhadas: calculateWorkedHours(r).toFixed(2)
        }));
        const csv = Papa.unparse(data);
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_ponto_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
    }

    const formatTime = (ts) => ts ? ts.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---';
    const formatDate = (ds) => { const [y, m, d] = ds.split('-'); return `${d}/${m}/${y}`; };
    function calculateWorkedHours(r) {
        const [e, si, fi, s] = [r['Entrada'], r['Início do Intervalo'], r['Fim do Intervalo'], r['Saída']];
        if (!e || !s) return 0; // Cálculo simplificado se não houver intervalo
        if (!si || !fi) return (s.toDate() - e.toDate()) / 3600000;
        const morning = si.toDate() - e.toDate();
        const afternoon = s.toDate() - fi.toDate();
        return (morning + afternoon) / 3600000;
    }

    // --- LÓGICA DA ABA DE CADASTRO ---
    const formCadastro = document.getElementById('cadastro-form');
    const secretariaCadastro = document.getElementById('secretaria-cadastro');
    const setorCadastro = document.getElementById('setor-cadastro');
    const messageCadastro = document.getElementById('message-cadastro');
    const submitButton = document.getElementById('submit-button');

    function popularSetoresCadastro() {
        const secretariaId = secretariaCadastro.value;
        setorCadastro.innerHTML = '';
        if (secretariaId) {
            const secretaria = secretariasData.find(s => s.id === secretariaId);
            if (secretaria && secretaria.setores) {
                setorCadastro.disabled = false;
                setorCadastro.innerHTML = '<option value="">Selecione um setor</option>';
                secretaria.setores.sort().forEach(setor => {
                    const option = document.createElement('option');
                    option.value = setor;
                    option.textContent = setor;
                    setorCadastro.appendChild(option);
                });
            }
        } else {
            setorCadastro.disabled = true;
            setorCadastro.innerHTML = '<option value="">Selecione uma secretaria</option>';
        }
    }

    formCadastro.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'Cadastrando...';
        messageCadastro.textContent = ''; // Limpa a mensagem anterior

        const isAdminChecked = document.getElementById('isAdmin').checked;
        const data = {
            nome: document.getElementById('nome').value,
            email: document.getElementById('email').value,
            cargo: document.getElementById('cargo-cadastro').value,
            matricula: document.getElementById('matricula').value,
            secretaria: secretariaCadastro.options[secretariaCadastro.selectedIndex].text,
            setor: setorCadastro.value,
            cargaHoraria: document.getElementById('cargaHoraria').value,
            administrador: isAdminChecked
        };
        const senha = Math.random().toString(36).slice(-8);

        // **CORREÇÃO INÍCIO: Usar instância temporária do Firebase**
        const tempAppName = `auth-app-${new Date().getTime()}`;
        const tempApp = firebase.initializeApp(firebaseConfig, tempAppName);
        const tempAuth = tempApp.auth();
        // **CORREÇÃO FIM**

        try {
            const cred = await tempAuth.createUserWithEmailAndPassword(data.email, senha);
            
            await db.collection("usuarios").doc(cred.user.uid).set(data);
            
            messageCadastro.innerHTML = `<strong>Sucesso!</strong> Usuário cadastrado.<br>Senha temporária: <strong style="color: #dc2626;">${senha}</strong>`;
            messageCadastro.className = "text-green-600 text-center mt-4 text-sm";
            formCadastro.reset();
            popularSetoresCadastro();

        } catch (error) {
            messageCadastro.textContent = `Erro: ${error.message}`;
            messageCadastro.className = "text-red-600 text-center mt-4 text-sm";
        } finally {
            // **CORREÇÃO INÍCIO: Limpar a instância temporária e reativar o botão**
            await tempAuth.signOut();
            await tempApp.delete();
            submitButton.disabled = false;
            submitButton.textContent = 'Cadastrar Usuário';
            // A linha que recarrega a página foi removida para corrigir o segundo erro.
            // **CORREÇÃO FIM**
        }
    });
    
    // --- LÓGICA CSV ---
    const csvFileInput = document.getElementById('csv-file');
    const processCsvBtn = document.getElementById('process-csv');
    const csvResultsDiv = document.getElementById('csv-results');
    const csvLogDiv = document.getElementById('csv-log');

    document.getElementById('download-template').addEventListener('click', (e) => {
        e.preventDefault();
        const csv = "nome,email,cargo,matricula,secretaria,setor,carga_horaria\nJoão da Silva,joao.silva@exemplo.com,Analista,JS123,Secretaria de Educação,Recursos Humanos,40";
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "modelo_cadastro.csv";
        link.click();
    });

    processCsvBtn.addEventListener('click', () => {
        const file = csvFileInput.files[0];
        if (!file) return alert("Selecione um ficheiro CSV.");
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: async (results) => {
                processCsvBtn.disabled = true;
                csvResultsDiv.classList.remove('hidden');
                csvLogDiv.innerHTML = '<p>Iniciando processamento...</p>';
                for (const user of results.data) {
                    await processUserRow(user);
                }
                csvLogDiv.innerHTML += '<p class="mt-4 font-bold">Processamento concluído.</p>';
                processCsvBtn.disabled = false;
            }
        });
    });

    async function processUserRow(user) {
        const { nome, email, cargo, matricula, secretaria, setor, carga_horaria } = user;
        if (!nome || !email || !setor || !carga_horaria) {
            logToCsvDiv(`Linha ignorada (dados incompletos): ${JSON.stringify(user)}`, 'error');
            return;
        }
        const senha = Math.random().toString(36).slice(-8);

        // **CORREÇÃO INÍCIO: Criar instância temporária para cada usuário do CSV**
        const tempAppName = `csv-auth-app-${new Date().getTime()}-${Math.random()}`;
        const tempApp = firebase.initializeApp(firebaseConfig, tempAppName);
        const tempAuth = tempApp.auth();
        // **CORREÇÃO FIM**
        
        try {
            const cred = await tempAuth.createUserWithEmailAndPassword(email, senha);
            
            const userData = {
                nome, email, cargo, matricula, secretaria, setor, 
                cargaHoraria: Number(carga_horaria),
                administrador: false
            };
            await db.collection("usuarios").doc(cred.user.uid).set(userData);
            logToCsvDiv(`SUCESSO: ${email} cadastrado. Senha: ${senha}`, 'success');
        } catch (error) {
            logToCsvDiv(`FALHA: ${email} - ${error.message}`, 'error');
        } finally {
            // **CORREÇÃO INÍCIO: Limpar a instância temporária após cada criação**
            await tempAuth.signOut();
            await tempApp.delete();
            // **CORREÇÃO FIM**
        }
    }
    const logToCsvDiv = (msg, type) => csvLogDiv.innerHTML += `<p class="${type}">${msg}</p>`;

    // --- INICIALIZAÇÃO E VERIFICAÇÃO DE PERMISSÃO ---
    document.addEventListener('DOMContentLoaded', () => {
        auth.onAuthStateChanged(async user => {
            if (user) {
                try {
                    const userDoc = await db.collection('usuarios').doc(user.uid).get();
                    if (userDoc.exists && userDoc.data().administrador === true) {
                        document.getElementById('main-content').style.display = 'block';
                        Promise.all([fetchData(), loadFilterOptions()]);
                    } else {
                        alert("Acesso negado. Você não tem permissão para ver esta página.");
                        window.location.href = './ponto.html';
                    }
                } catch (error) {
                    console.error("Erro ao verificar permissão:", error);
                    window.location.href = './index.html';
                }
            } else {
                window.location.href = './index.html';
            }
        });
        applyFilterBtn.addEventListener('click', applyFilters);
        clearFiltersBtn.addEventListener('click', () => {
            document.querySelectorAll('input').forEach(i => i.value = '');
            document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
            populateSetorFilter();
            applyFilters();
        });
        secretariaFilter.addEventListener('change', populateSetorFilter);
        secretariaCadastro.addEventListener('change', popularSetoresCadastro);
        exportPdfBtn.addEventListener('click', exportToPDF);
        exportCsvBtn.addEventListener('click', exportToCSV);
    });