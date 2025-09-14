// Importa os módulos necessários para ler e escrever arquivos.
const fs = require('fs');
const path = require('path');

console.log("Iniciando a migração de dados...");

// --- ETAPA 1: DEFINIR OS CAMINHOS DOS ARQUIVOS ---
// Define onde estão os arquivos de origem e onde o novo arquivo será salvo.
const dadosAntigosPath = path.join(__dirname, 'dados.json');
const databaseAtualPath = path.join(__dirname, 'database.json');

// --- ETAPA 2: LER OS ARQUIVOS JSON ---
// O 'try...catch' garante que, se houver um erro (ex: arquivo não encontrado), o programa avise.
let dadosAntigos;
let databaseAtual;

try {
    // Lê o conteúdo dos arquivos como texto e o converte para um objeto JavaScript.
    dadosAntigos = JSON.parse(fs.readFileSync(dadosAntigosPath, 'utf-8'));
    databaseAtual = JSON.parse(fs.readFileSync(databaseAtualPath, 'utf-8'));
    console.log(`Encontrados ${dadosAntigos.processes.length} processos para migrar.`);
} catch (error) {
    console.error("Erro ao ler os arquivos JSON. Verifique se 'dados.json' e 'database.json' existem na pasta.", error);
    return; // Encerra o script se não conseguir ler os arquivos.
}

// --- FUNÇÕES AUXILIARES ---

/**
 * Gera um ID único no mesmo formato que a aplicação principal.
 * @returns {string} Um ID alfanumérico único.
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Limpa e padroniza o campo 'modalidade' para os valores que o sistema espera.
 * Se não for um valor conhecido, retorna 'Outros'.
 * @param {string} modalidade - O valor original da modalidade.
 * @returns {string} A modalidade padronizada.
 */
function mapearModalidade(modalidade) {
    const mod = modalidade.trim().toLowerCase();
    if (mod.includes('dispensa')) return 'Dispensa';
    if (mod.includes('pregão') || mod.includes('pregao')) return 'Pregão Eletrônico';
    if (mod.includes('inexigibilidade')) return 'Inexigibilidade';
    if (mod.includes('adiantamento')) return 'Adiantamento';
    return 'Outros';
}

/**
 * Combina informações para o campo 'paymentTypeOther' quando a modalidade é 'Outros'.
 * @param {string} modalidade - O valor original da modalidade.
 * @param {string} numMod - O número da modalidade do arquivo antigo.
 * @returns {string} O texto para o campo 'paymentTypeOther'.
 */
function getModalidadeOutra(modalidade, numMod) {
    const tipoMapeado = mapearModalidade(modalidade);
    // Se a modalidade foi mapeada como 'Outros', usamos o texto original.
    if (tipoMapeado === 'Outros' && modalidade.trim() !== '-') {
        return `${modalidade.trim()} ${numMod.trim()}`.trim();
    }
    // Se foi mapeada para um tipo conhecido, mas tem um 'numMod', o adicionamos como um extra.
    if (numMod && numMod.trim() !== '-') {
        return numMod.trim();
    }
    return ''; // Retorna vazio se não houver informação extra.
}

// --- ETAPA 3: TRANSFORMAR OS DADOS ---
// 'map' percorre cada item do array de processos antigos e o transforma em um novo item no formato correto.
const processosMapeados = dadosAntigos.processes.map(processoAntigo => {
    
    // Para cada processo antigo, criamos um objeto novo com a estrutura do database.json
    const novoProcesso = {
        id: generateId(), // Gera um ID novo e único
        processNumber: processoAntigo.pc ? processoAntigo.pc.trim() : 'N/A',
        supplier: processoAntigo.fornecedor ? processoAntigo.fornecedor.trim() : 'Não informado',
        paymentType: mapearModalidade(processoAntigo.modalidade || ''),
        paymentTypeOther: getModalidadeOutra(processoAntigo.modalidade || '', processoAntigo.numMod || ''),
        description: processoAntigo.info ? processoAntigo.info.trim() : '',
        documents: [], // Campo novo, inicia como um array vazio
        locationInfo: "Contabilidade", // Valor padrão para a localização
        locationOtherText: "", // Campo novo, inicia vazio
        createdAt: new Date().toISOString() // Adiciona a data de criação/migração
    };
    return novoProcesso;
});

console.log("Mapeamento de processos concluído.");

// --- ETAPA 4: JUNTAR OS DADOS NOVOS COM OS EXISTENTES ---
// Adiciona os processos recém-mapeados à lista de processos do database atual.
// O '...' (spread operator) desempacota o array 'processosMapeados' e insere seus itens um a um.
databaseAtual.processes.push(...processosMapeados);

console.log(`Total de processos no novo arquivo: ${databaseAtual.processes.length}`);

// --- ETAPA 5: SALVAR O NOVO ARQUIVO ---
try {
    // Escreve o objeto 'databaseAtual' (agora com todos os processos) de volta para o arquivo 'database.json'.
    // JSON.stringify(..., null, 2) formata o arquivo para que seja legível.
    fs.writeFileSync(databaseAtualPath, JSON.stringify(databaseAtual, null, 2), 'utf-8');
    console.log("\nSucesso! O arquivo 'database.json' foi atualizado com os novos processos.");
} catch (error) {
    console.error("Erro ao salvar o arquivo 'database.json' atualizado.", error);
}