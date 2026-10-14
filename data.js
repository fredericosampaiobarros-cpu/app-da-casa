// Biblioteca de funções, tarefas, avisos e pratos do App da Casa.
// Tudo aqui é editável sem mexer no resto do código.

export const DAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const DAY_LONG = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export const FREQ_LABEL = {
  daily: 'Todo dia de trabalho',
  weekly: 'Uma vez por semana',
  biweekly: 'A cada 15 dias',
  monthly: 'Uma vez por mês',
};

export const ROLES = {
  baba:       { label: 'Babá',         days: [0, 1, 2, 3, 4] },
  diarista:   { label: 'Diarista',     days: [1, 4] },
  motorista:  { label: 'Motorista',    days: [0, 1, 2, 3, 4] },
  cozinheira: { label: 'Cozinheira',   days: [1, 4] },
  passadeira: { label: 'Passadeira',   days: [2] },
  jardineiro: { label: 'Jardineiro',   days: [5] },
  piscineiro: { label: 'Piscineiro',   days: [1] },
  cuidador:   { label: 'Cuidador(a)',  days: [0, 1, 2, 3, 4] },
};

// Opções da configuração da casa
export const HOUSE_OPTIONS = {
  tipo: ['Apartamento', 'Casa', 'Casa em condomínio'],
  quartos: ['1', '2', '3', '4', '5+'],
  banheiros: ['1', '2', '3', '4+'],
  lavabo: ['Não', 'Sim'],
  adultos: ['1', '2', '3', '4+'],
  criancas: ['0', '1', '2', '3+'],
  idade: ['0–1 ano', '2–3 anos', '4–6 anos', '7–10 anos', '11+ anos'],
  almoco: ['Em casa', 'Na escola', 'Depende do dia'],
  serve: ['Babá', 'Cozinheira', 'Diarista', 'A família'],
  roupaCriancas: ['Babá', 'Diarista', 'Passadeira'],
  cama: ['Toda semana', 'A cada 15 dias'],
  mercado: ['Pedimos por app', 'Motorista vai', 'A família vai'],
};
export const EXTRAS = [
  ['varanda', 'Varanda'], ['areaServico', 'Área de serviço'], ['quintal', 'Quintal'],
  ['jardim', 'Jardim'], ['piscina', 'Piscina'], ['pet', 'Pet'], ['carro', 'Carro'],
];

const kids = c => Number(String(c.criancas || '0')[0]) > 0;

// Tarefas sugeridas por função. `when` decide se entra para esta casa.
// `day: 'first' | 'last'` escolhe o dia da semana entre os dias de trabalho.
export const TASKS = {
  baba: [
    { label: 'Lanches e refeições das crianças', freq: 'daily', critical: true, when: kids },
    { label: 'Esquentar e servir o almoço', freq: 'daily', critical: true, when: c => kids(c) && c.serve === 'Babá' && c.almoco !== 'Na escola' },
    { label: 'Banho e roupa das crianças', freq: 'daily', when: kids },
    { label: 'Arrumar camas e quarto das crianças', freq: 'daily', when: kids },
    { label: 'Organizar brinquedos no fim do dia', freq: 'daily', when: kids },
    { label: 'Lavar louça das crianças', freq: 'daily', when: kids },
    { label: 'Higienizar lancheiras e garrafinhas', freq: 'daily', when: kids },
    { label: 'Lavar, dobrar e guardar roupa das crianças', freq: 'daily', when: c => kids(c) && c.roupaCriancas === 'Babá' },
    { label: 'Organizar mochila e uniforme do dia seguinte', freq: 'daily', when: kids },
    { label: 'Trocar roupa de cama das crianças', freq: 'weekly', day: 'last', when: kids },
  ],
  diarista: [
    { label: 'Banheiros completos', freq: 'daily', critical: true },
    { label: 'Lavabo', freq: 'daily', when: c => c.lavabo === 'Sim' },
    { label: 'Cozinha: fogão, pia e bancadas', freq: 'daily', critical: true },
    { label: 'Aspirar e passar pano na casa', freq: 'daily' },
    { label: 'Tirar pó de móveis e prateleiras', freq: 'daily' },
    { label: 'Lavar e passar roupa dos adultos', freq: 'daily' },
    { label: 'Lavar, dobrar e guardar roupa das crianças', freq: 'daily', when: c => kids(c) && c.roupaCriancas === 'Diarista' },
    { label: 'Trocar roupa de cama', freq: 'weekly', day: 'last', when: c => c.cama === 'Toda semana' },
    { label: 'Trocar roupa de cama', freq: 'biweekly', day: 'last', when: c => c.cama !== 'Toda semana' },
    { label: 'Trocar toalhas', freq: 'weekly', day: 'first' },
    { label: 'Geladeira por dentro', freq: 'biweekly', day: 'first' },
    { label: 'Vidros e janelas', freq: 'monthly', day: 'first', critical: true },
    { label: 'Varanda', freq: 'weekly', day: 'last', when: c => c.extras?.varanda },
    { label: 'Área de serviço', freq: 'weekly', day: 'first', when: c => c.extras?.areaServico },
    { label: 'Quintal', freq: 'weekly', day: 'last', when: c => c.extras?.quintal },
    { label: 'Limpar caminha e potes do pet', freq: 'weekly', day: 'first', when: c => c.extras?.pet },
  ],
  motorista: [
    { label: 'Levar e buscar as crianças (ver agenda)', freq: 'daily', critical: true, when: kids },
    { label: 'Abastecer o carro', freq: 'weekly', day: 'first' },
    { label: 'Lavar o carro', freq: 'weekly', day: 'last' },
    { label: 'Calibrar os pneus', freq: 'biweekly', day: 'first' },
    { label: 'Conferir óleo e água', freq: 'monthly', day: 'first' },
    { label: 'Fazer ou retirar as compras', freq: 'weekly', day: 'first', when: c => c.mercado === 'Motorista vai' },
  ],
  cozinheira: [
    { label: 'Preparar as refeições do cardápio', freq: 'daily', critical: true },
    { label: 'Porcionar e congelar marmitas das crianças, com etiqueta do dia', freq: 'daily', when: kids },
    { label: 'Conferir o que falta para os próximos dias', freq: 'daily' },
    { label: 'Deixar a cozinha limpa ao terminar', freq: 'daily' },
  ],
  passadeira: [
    { label: 'Passar a roupa da semana', freq: 'daily', critical: true },
    { label: 'Guardar a roupa passada', freq: 'daily' },
    { label: 'Organizar um armário', freq: 'weekly', day: 'first' },
  ],
  jardineiro: [
    { label: 'Cortar a grama', freq: 'daily' },
    { label: 'Podar plantas e cerca viva', freq: 'monthly', day: 'first' },
    { label: 'Recolher folhas', freq: 'daily' },
    { label: 'Adubar', freq: 'monthly', day: 'first' },
  ],
  piscineiro: [
    { label: 'Tratar a água e medir o cloro', freq: 'daily', critical: true },
    { label: 'Aspirar a piscina', freq: 'daily' },
    { label: 'Limpar bordas e peneirar', freq: 'daily' },
    { label: 'Retrolavar o filtro', freq: 'biweekly', day: 'first' },
  ],
  cuidador: [
    { label: 'Medicamentos nos horários', freq: 'daily', critical: true },
    { label: 'Refeições e hidratação', freq: 'daily', critical: true },
    { label: 'Higiene e banho', freq: 'daily' },
    { label: 'Caminhada ou atividade', freq: 'daily' },
  ],
};

// Tarefas extras que a família pode adicionar pela lista
export const EXTRA_TASKS = {
  baba: ['Levar ao parquinho', 'Acompanhar lição de casa', 'Separar roupa para doação', 'Levar ao pediatra (ver agenda)', 'Preparar lanche da escola'],
  diarista: ['Passar roupa de cama', 'Limpar armários da cozinha', 'Organizar despensa', 'Limpar forno e micro-ondas', 'Limpar rodapés e portas', 'Lavar tapetes', 'Regar plantas', 'Limpar ventiladores e luminárias'],
  motorista: ['Levar o carro na revisão', 'Pagar estacionamento e pedágio', 'Buscar encomendas', 'Levar a família ao aeroporto', 'Trocar o óleo', 'Lavar o segundo carro'],
  cozinheira: ['Fazer pão ou bolo da semana', 'Preparar lanches das crianças', 'Higienizar frutas e verduras', 'Limpar a geladeira'],
  passadeira: ['Passar roupa de cama', 'Costurar barras e botões'],
  jardineiro: ['Limpar calhas', 'Plantar mudas', 'Trocar terra dos vasos'],
  piscineiro: ['Limpar a casa de máquinas', 'Trocar a areia do filtro'],
  cuidador: ['Acompanhar em consulta (ver agenda)', 'Exercícios de fisioterapia', 'Leitura ou jogo'],
};

// Avisos que cada função pode mandar. `item` vai para a lista de compras.
const product = (name, kind = 'mercado') => ({ label: `Acabou: ${name}`, kind, item: name });
const CLEANING = ['Sapólio', 'Detergente', 'Desinfetante', 'Multiuso', 'Sabão em pó', 'Amaciante', 'Água sanitária', 'Saco de lixo', 'Esponja', 'Papel higiênico', 'Limpa-vidros', 'Lustra-móveis'];
export const ALERTS = {
  motorista: [
    { label: 'Gasolina acabando', kind: 'carro' },
    { label: 'Precisa lavar o carro', kind: 'carro' },
    { label: 'Pneu baixo', kind: 'carro' },
    { label: 'Luz acesa no painel', kind: 'carro' },
    { label: 'Revisão chegando', kind: 'carro' },
    { label: 'Multa ou documento do carro', kind: 'carro' },
  ],
  diarista: CLEANING.map(n => product(n, 'limpeza')),
  passadeira: [product('Água para passar', 'limpeza'), product('Cabides', 'limpeza'), { label: 'Ferro com problema', kind: 'quebrado' }],
  baba: ['Arroz', 'Feijão', 'Leite', 'Frutas', 'Pão', 'Ovos', 'Iogurte', 'Fralda', 'Lenço umedecido', 'Pasta de dente infantil']
    .map(n => product(n)).concat([{ label: 'Não tem comida para o almoço', kind: 'urgente' }]),
  cozinheira: ['Arroz', 'Feijão', 'Azeite', 'Óleo', 'Sal', 'Alho', 'Cebola', 'Tomate', 'Ovos', 'Farinha de trigo']
    .map(n => product(n)).concat([{ label: 'Utensílio ou panela quebrada', kind: 'quebrado' }]),
  jardineiro: [product('Adubo'), product('Saco de lixo grande', 'limpeza'), { label: 'Ferramenta quebrada', kind: 'quebrado' }, { label: 'Problema na irrigação', kind: 'quebrado' }],
  piscineiro: [product('Cloro', 'limpeza'), product('Algicida', 'limpeza'), { label: 'Bomba com problema', kind: 'quebrado' }],
  cuidador: [{ label: 'Remédio acabando', kind: 'urgente' }, product('Fralda geriátrica'), { label: 'Precisa de atenção da família', kind: 'urgente' }],
};
export const COMMON_ALERTS = [
  { label: 'Algo quebrou na casa', kind: 'quebrado' },
  { label: 'Vou me atrasar hoje', kind: 'recado' },
  { label: 'Preciso sair mais cedo', kind: 'recado' },
];

// Pratos para o cardápio (comida de verdade, base arroz e feijão no almoço)
export const DISHES = [
  { name: 'Frango assado com batata-doce e brócolis', meal: 'almoco', ing: ['Arroz', 'Feijão', 'Peito de frango', 'Batata-doce', 'Brócolis'] },
  { name: 'Carne moída com abobrinha e cenoura', meal: 'almoco', ing: ['Arroz', 'Feijão', 'Carne moída', 'Abobrinha', 'Cenoura'] },
  { name: 'Peixe assado com limão e chuchu', meal: 'almoco', ing: ['Arroz', 'Feijão', 'Filé de peixe', 'Limão', 'Chuchu'] },
  { name: 'Almôndegas ao sugo com vagem', meal: 'almoco', ing: ['Arroz', 'Feijão', 'Carne moída', 'Tomate pelado', 'Vagem'] },
  { name: 'Sobrecoxa assada com couve refogada', meal: 'almoco', ing: ['Arroz', 'Feijão', 'Sobrecoxa', 'Couve'] },
  { name: 'Carne de panela com cenoura e batata', meal: 'almoco', ing: ['Arroz', 'Feijão', 'Músculo', 'Cenoura', 'Batata'] },
  { name: 'Frango xadrez com pimentão e brócolis', meal: 'almoco', ing: ['Arroz', 'Peito de frango', 'Pimentão', 'Brócolis'] },
  { name: 'Lentilha com picadinho e abóbora assada', meal: 'almoco', ing: ['Arroz', 'Lentilha', 'Patinho', 'Abóbora'] },
  { name: 'Peixe ao molho de tomate com ervilha', meal: 'almoco', ing: ['Arroz', 'Feijão', 'Filé de peixe', 'Tomate pelado', 'Ervilha'] },
  { name: 'Lagarto assado com purê e vagem', meal: 'almoco', ing: ['Arroz', 'Feijão', 'Lagarto', 'Batata', 'Leite', 'Vagem'] },
  { name: 'Frango grelhado, farofa de cenoura e salada', meal: 'almoco', ing: ['Arroz', 'Feijão', 'Peito de frango', 'Farinha de mandioca', 'Cenoura', 'Alface', 'Tomate'] },
  { name: 'Grão-de-bico com frango ao curry suave', meal: 'almoco', ing: ['Arroz', 'Grão-de-bico', 'Peito de frango', 'Couve-flor'] },
  { name: 'Sopa de legumes com macarrão de letrinhas', meal: 'jantar', ing: ['Macarrão de letrinhas', 'Batata', 'Cenoura', 'Abobrinha', 'Chuchu'] },
  { name: 'Omelete de espinafre com purê de mandioquinha', meal: 'jantar', ing: ['Ovos', 'Espinafre', 'Mandioquinha', 'Leite'] },
  { name: 'Escondidinho de frango com abóbora', meal: 'jantar', ing: ['Peito de frango', 'Abóbora', 'Queijo'] },
  { name: 'Panqueca de carne com molho de tomate', meal: 'jantar', ing: ['Carne moída', 'Ovos', 'Farinha de trigo', 'Leite', 'Tomate pelado'] },
  { name: 'Macarrão com molho de tomate e legumes', meal: 'jantar', ing: ['Macarrão', 'Tomate pelado', 'Abobrinha', 'Cenoura'] },
  { name: 'Caldo verde', meal: 'jantar', ing: ['Batata', 'Couve', 'Linguiça calabresa'] },
  { name: 'Wrap de frango com alface e tomate', meal: 'jantar', ing: ['Pão folha', 'Peito de frango', 'Alface', 'Tomate'] },
  { name: 'Torta de legumes de liquidificador', meal: 'jantar', ing: ['Ovos', 'Farinha de trigo', 'Leite', 'Cenoura', 'Ervilha', 'Milho'] },
  { name: 'Arroz de forno com frango e milho', meal: 'jantar', ing: ['Arroz', 'Peito de frango', 'Milho', 'Queijo'] },
  { name: 'Ovos mexidos com tomate e pão integral', meal: 'jantar', ing: ['Ovos', 'Tomate', 'Pão integral'] },
  { name: 'Sopa creme de abóbora com frango', meal: 'jantar', ing: ['Abóbora', 'Peito de frango', 'Cebola'] },
  { name: 'Canja de galinha', meal: 'jantar', ing: ['Arroz', 'Peito de frango', 'Cenoura', 'Batata'] },
  { name: 'Panqueca de espinafre com queijo', meal: 'jantar', ing: ['Espinafre', 'Ovos', 'Farinha de trigo', 'Leite', 'Queijo'] },
  { name: 'Macarrão ao pesto com frango', meal: 'jantar', ing: ['Macarrão', 'Manjericão', 'Peito de frango', 'Queijo'] },
];

// Itens comuns da despensa (aparecem na tela de despensa mesmo sem cadastro)
export const COMMON_PANTRY = {
  mercado: ['Arroz', 'Feijão', 'Macarrão', 'Azeite', 'Óleo', 'Sal', 'Açúcar', 'Café', 'Leite', 'Ovos', 'Farinha de trigo', 'Tomate pelado', 'Alho', 'Cebola', 'Pão', 'Frutas', 'Iogurte'],
  limpeza: CLEANING,
};

// Gera as tarefas sugeridas para um funcionário nesta casa
export function suggestTasks(role, cfg, days) {
  const list = TASKS[role] || [];
  const sorted = [...days].sort((a, b) => a - b);
  return list
    .filter(t => !t.when || t.when(cfg))
    .map((t, i) => ({
      label: t.label,
      freq: t.freq,
      weekday: t.freq === 'daily' ? null : (t.day === 'last' ? sorted[sorted.length - 1] : sorted[0]),
      critical: !!t.critical,
      sort: i,
    }));
}
