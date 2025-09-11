// CÓDIGO CORRIGIDO COM A ORDEM CORRETA
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 8000;
const HOST = '0.0.0.0';
const PUBLIC_DIR = __dirname;
const DB_FILE = path.join(__dirname, 'database.json');

// --- 1. Middlewares (Executados primeiro) ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- 2. Rotas da API (Devem vir ANTES do servidor de arquivos estáticos) ---
app.get('/api/data', (req, res) => {
    const data = readDB();
    res.status(200).json(data);
});

app.post('/api/data', (req, res) => {
    const newData = req.body;
    if (newData && typeof newData === 'object') {
        writeDB(newData);
        res.status(200).json({ message: 'Dados salvos com sucesso.' });
    } else {
        res.status(400).json({ message: 'Formato de dados inválido.' });
    }
});

// --- 3. Servidor de Arquivos Estáticos ---
app.use(express.static(PUBLIC_DIR));

// --- 4. Rota de Fallback para SPA (DEVE SER A ÚLTIMA ROTA "GET") ---
// Se nenhuma rota de API ou arquivo estático for encontrado, ele serve o index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- Iniciar o Servidor ---
app.listen(PORT, HOST, () => {
    console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});


// --- Funções Auxiliares (sem alterações) ---
const readDB = () => {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf-8');
            if (data.trim() === '') return { processes: [], payments: [], users: [], activities: [] };
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Erro ao ler o arquivo de banco de dados:', error);
    }
    return { processes: [], payments: [], users: [], activities: [] };
};

const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Erro ao escrever no arquivo de banco de dados:', error);
    }
};
