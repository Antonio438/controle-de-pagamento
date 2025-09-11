// =================================================================
//          CÓDIGO COMPLETO E FINAL PARA O server.js
// =================================================================
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();

// --- 1. CONFIGURAÇÕES ESSENCIAIS PARA O RENDER ---
// O Render define a porta através de uma variável de ambiente (process.env.PORT)
const PORT = process.env.PORT || 8000;
// O HOST deve ser '0.0.0.0' para aceitar conexões externas no Render
const HOST = '0.0.0.0';
// Diz ao servidor para procurar os arquivos na pasta raiz do projeto (onde está o index.html)
const PUBLIC_DIR = __dirname;
// Caminho para o arquivo de banco de dados
const DB_FILE = path.join(__dirname, 'database.json');


// --- 2. MIDDLEWARES (Configurações do Express) ---
// Habilita o CORS para permitir que a API seja chamada de outros domínios
app.use(cors());
// Habilita o Express para entender requisições com corpo em JSON
app.use(express.json({ limit: '50mb' }));


// --- 3. ROTAS DA API (DEVEM VIR ANTES DOS ARQUIVOS ESTÁTICOS) ---
// Rota para LER os dados do banco de dados
app.get('/api/data', (req, res) => {
    const data = readDB();
    res.status(200).json(data);
});

// Rota para SALVAR os dados no banco de dados
app.post('/api/data', (req, res) => {
    const newData = req.body;
    if (newData && typeof newData === 'object') {
        writeDB(newData);
        res.status(200).json({ message: 'Dados salvos com sucesso.' });
    } else {
        res.status(400).json({ message: 'Formato de dados inválido.' });
    }
});


// --- 4. SERVIDOR DE ARQUIVOS ESTÁTICOS E ROTA DE FALLBACK ---
// Serve os arquivos estáticos (index.html, script.js, style.css)
app.use(express.static(PUBLIC_DIR));
// Rota "catch-all": Se nenhuma rota de API ou arquivo for encontrado, serve o index.html
// Essencial para Single Page Applications (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});


// --- 5. INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, HOST, () => {
    console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});


// --- 6. FUNÇÕES AUXILIARES (À Prova de Falhas) ---
// Função para ler o banco de dados sem quebrar o servidor
const readDB = () => {
    // Se o arquivo não existir, retorna um objeto padrão
    if (!fs.existsSync(DB_FILE)) {
        return { processes: [], payments: [], users: [], activities: [] };
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    // Se o arquivo estiver vazio, retorna um objeto padrão
    if (data.trim() === '') {
        return { processes: [], payments: [], users: [], activities: [] };
    }
    // Tenta converter o texto para JSON. Se falhar, não quebra o servidor.
    try {
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao fazer parse do JSON:', error);
        return { processes: [], payments: [], users: [], activities: [] };
    }
};

// Função para escrever no banco de dados
const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Erro ao escrever no arquivo:', error);
    }
};
