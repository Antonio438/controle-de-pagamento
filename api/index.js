// =================================================================
//      CÓDIGO FINAL COM BANCO DE DADOS VERCEL POSTGRES
// =================================================================
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // Importa o "tradutor" do Postgres

const app = express();

// --- 1. CONFIGURAÇÃO DO BANCO DE DADOS ---
// O Pool gerencia as conexões com o banco de dados.
// Ele usa a variável de ambiente POSTGRES_URL que a Vercel criou.
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- 2. MIDDLEWARES (Configurações do Express) ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- 3. ROTAS DA API ---

// Rota para LER todos os dados do banco de dados
app.get('/api/data', async (req, res) => {
  try {
    // Fazemos 4 buscas no banco de dados em paralelo
    const [processesResult, paymentsResult, usersResult, activitiesResult] = await Promise.all([
      pool.query('SELECT * FROM processes'),
      pool.query('SELECT * FROM payments'),
      pool.query('SELECT * FROM users'),
      pool.query('SELECT * FROM activities')
    ]);

    // Extraímos os dados e formatamos como o front-end espera
    const data = {
      processes: processesResult.rows.map(row => ({ id: row.id, ...row.data })),
      payments: paymentsResult.rows.map(row => ({ id: row.id, ...row.data })),
      users: usersResult.rows,
      activities: activitiesResult.rows.map(row => ({ id: row.id, ...row.data }))
    };
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Erro ao ler dados do banco:', error);
    res.status(500).json({ message: 'Erro interno ao buscar dados.' });
  }
});

// Rota para SALVAR todos os dados no banco de dados
app.post('/api/data', async (req, res) => {
  const { processes, payments, users, activities } = req.body;
  const client = await pool.connect(); // Pega uma conexão para fazer várias operações

  try {
    await client.query('BEGIN'); // Inicia uma "transação" segura

    // Limpa as tabelas antes de inserir os novos dados
    await client.query('DELETE FROM processes');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM activities');

    // Insere os novos dados
    if (processes && processes.length > 0) {
      for (const process of processes) {
        const { id, ...data } = process;
        await client.query('INSERT INTO processes (id, data) VALUES ($1, $2)', [id, data]);
      }
    }
    if (payments && payments.length > 0) {
        for (const payment of payments) {
            const { id, ...data } = payment;
            await client.query('INSERT INTO payments (id, data) VALUES ($1, $2)', [id, data]);
        }
    }
    if (users && users.length > 0) {
        for (const user of users) {
            await client.query('INSERT INTO users (username, password) VALUES ($1, $2)', [user.username, user.password]);
        }
    }
    if (activities && activities.length > 0) {
        for (const activity of activities) {
            const { id, ...data } = activity;
            await client.query('INSERT INTO activities (id, data) VALUES ($1, $2)', [id, data]);
        }
    }

    await client.query('COMMIT'); // Confirma todas as operações
    res.status(200).json({ message: 'Dados salvos com sucesso no banco de dados.' });

  } catch (error) {
    await client.query('ROLLBACK'); // Desfaz tudo se der algum erro
    console.error('Erro ao salvar dados no banco:', error);
    res.status(500).json({ message: 'Erro interno ao salvar dados.' });
  } finally {
    client.release(); // Libera a conexão
  }
});

// --- 4. EXPORTAÇÃO PARA A VERCEL ---
module.exports = app;