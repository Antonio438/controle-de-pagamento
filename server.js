// CÓDIGO 100% COMPLETO E CORRIGIDO
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();

// --- ALTERAÇÃO 1: Definir a porta a partir do ambiente e o HOST correto ---
const PORT = process.env.PORT || 8000; // Render define a porta via variável de ambiente
const HOST = '0.0.0.0'; // ESSENCIAL: Escutar em todas as interfaces de rede
// ---------------------------------------------------------------------

// --- ALTERAÇÃO 2: Apontar para o diretório raiz para os arquivos estáticos ---
const PUBLIC_DIR = __dirname; // Seus arquivos estão na raiz do projeto
// -----------------------------------------------------------------------
const DB_FILE = path.join(__dirname, 'database.json');

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Rotas da API ---
app.get('/api/data', (req, res) => {
    const data = readDB();
    res.status(200).json(data);
});

app.post('/api/data', (req, res) => {
    const newData = req.body;
    // Adicionada uma verificação mais robusta
    if (newData && typeof newData === 'object') {
        writeDB(newData);
        res.status(200).json({ message: 'Dados salvos com sucesso.' });
    } else {
        res.status(400).json({ message: 'Formato de dados inválido.' });
    }
});

// --- Servidor de Arquivos Estáticos ---
app.use(express.static(PUBLIC_DIR));

// --- Rota de Fallback para SPA ---
// Garante que o index.html seja servido para qualquer rota não-API
app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- Iniciar o Servidor ---
app.listen(PORT, HOST, () => {
    console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});

// --- Funções Auxiliares ---
const readDB = () => {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf-8');
            if (data.trim() === '') {
                return { processes: [], payments: [], users: [], activities: [] };
            }
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
