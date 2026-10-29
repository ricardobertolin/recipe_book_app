/** Rebuild the user's Portuguese learning list as an importable Recipe Book. */
import { writeFileSync } from 'node:fs';

// Within each chapter: five Easy, five Medium, five Hard, in the supplied order.
const chapters = [
  ['Café da manhã', `
Ovos mexidos cremosos — controlar o ponto dos ovos.
Pão na chapa com manteiga — dourar sem queimar.
Tapioca recheada — acertar textura e quantidade de recheio.
Panqueca de banana e aveia — preparar massa e virar.
Omelete de queijo e presunto — cozinhar uniformemente.
Panquecas americanas — massa aerada e ponto da frigideira.
Rabanada francesa — absorção e douramento.
Crepioca recheada — consistência e montagem.
Ovos pochê — coagulação sem casca.
Sanduíche de café da manhã — preparar ovos, bacon e queijo no tempo certo.
Ovos Benedict — ovos pochê e molho holandês.
Croissant caseiro — massa folhada fermentada.
Brioche francês — fermentação e massa enriquecida.
Shakshuka elaborada — molho de tomate temperado e ovos no ponto.
Soufflé de queijo — incorporação de ar e controle de forno.
`],
  ['Almoço', `
Arroz branco soltinho — proporção de água e cozimento.
Macarrão alho e óleo — ponto da massa e alho dourado.
Frango grelhado — tempero e temperatura.
Carne moída refogada — selar, temperar e controlar umidade.
Batata assada com ervas — cortes e assamento uniforme.
Estrogonofe de frango — molho cremoso.
Bife acebolado com purê — ponto da carne e purê.
Frango à parmegiana — empanar, fritar e gratinar.
Lasanha à bolonhesa — molho e montagem em camadas.
Feijão carioca temperado — panela de pressão e caldo encorpado.
Risoto de cogumelos — absorção de caldo e textura.
Feijoada completa — dessalga e diferentes tempos de cozimento.
Costela bovina assada lentamente — temperatura e maciez.
Paella espanhola — arroz, frutos do mar e ponto.
Beef Wellington — carne, duxelles e massa folhada.
`],
  ['Jantar', `
Misto-quente caprichado — crocância e queijo derretido.
Wrap de frango e salada — montagem e recheio.
Sopa de legumes — cortes e cozimento.
Sanduíche de atum — equilíbrio dos ingredientes.
Omelete de forno — preparo e ponto.
Hambúrguer artesanal — moldagem, selagem e montagem.
Pizza de frigideira com massa caseira — massa e cocção.
Quiche de alho-poró — massa e recheio cremoso.
Caldo verde com linguiça — textura e temperos.
Tacos mexicanos de carne — temperos, recheio e montagem.
Pizza napolitana caseira — fermentação e abertura da massa.
Ramen japonês completo — caldo, tare e acompanhamentos.
Sushi e uramaki — arroz temperado e montagem.
Nhoque caseiro ao molho de queijo — massa delicada e molho.
Pato com molho de laranja — ponto da carne e redução.
`, 'Aqui priorizei pratos que podem funcionar como refeições completas, incluindo opções mais leves e pratos para ocasiões especiais.'],
  ['Sobremesas', `
Brigadeiro tradicional — ponto de panela.
Mousse de limão — proporções e consistência.
Salada de frutas — cortes e combinação de sabores.
Palha italiana — mistura e corte.
Banana caramelizada — caramelização.
Brownie de chocolate — textura interna.
Pudim de leite condensado — caramelo e banho-maria.
Bolo de cenoura com cobertura — massa e cobertura.
Cookies americanos — ponto e textura.
Cheesecake assado — base e creme.
Petit gâteau — interior líquido.
Crème brûlée — creme assado e açúcar caramelizado.
Tiramisù tradicional — creme e montagem.
Macarons franceses — merengue e macaronage.
Mil-folhas francês — massa folhada e creme de confeiteiro.
`],
  ['Lanches e salgados', `
Pão de queijo de liquidificador — mistura e forno.
Bruschetta de tomate — montagem e temperos.
Pipoca temperada — controle de calor.
Sanduíche natural de frango — recheio e montagem.
Torradas com patê caseiro — textura e temperos.
Coxinha de frango — massa, recheio e fritura.
Empadinha de frango — massa quebradiça.
Pastel caseiro — massa e fritura.
Esfiha aberta — fermentação e modelagem.
Bolinho de arroz com queijo — consistência e fritura.
Pão de fermentação natural — levain e fermentação.
Folhado de queijo e presunto — laminação da massa.
Bagel tradicional — fermentação e fervura.
Croquete de carne — massa, empanamento e fritura.
Pretzel alemão tradicional — modelagem e banho alcalino.
`, 'Uma categoria útil para aprender a trabalhar com massas, frituras, recheios e preparos que podem ser congelados.'],
  ['Molhos, acompanhamentos e bases culinárias', `
Molho de tomate caseiro — refogar e reduzir.
Purê de batatas — textura cremosa.
Vinagrete brasileiro — cortes e acidez.
Legumes salteados — controle de calor.
Farofa de manteiga e cebola — tostagem.
Molho bechamel — roux e espessamento.
Molho pesto tradicional — emulsão e textura.
Maionese caseira com ovo pasteurizado — emulsificação.
Batata gratinada — camadas e forno.
Caldo de frango caseiro — extração de sabor.
Molho holandês — emulsão quente.
Molho demi-glace — redução e concentração.
Molho béarnaise — emulsão e infusão.
Massa fresca de ovos — sova, descanso e abertura.
Massa folhada artesanal — laminação e controle de temperatura.
`, 'Essa é uma das categorias mais importantes para quem quer realmente aprender a cozinhar, porque suas técnicas podem ser reutilizadas em dezenas de pratos.']
];

const groups = chapters.map(([name], i) => ({
  id: `aprendizado-grupo-${i + 1}`, name, colorIndex: i % 5
}));
const recipes = chapters.flatMap(([, text, context], chapter) => {
  const lines = text.trim().split('\n');
  if (lines.length !== 15) throw new Error(`Expected 15 recipes in chapter ${chapter + 1}`);
  return lines.map((line, i) => {
    const [title, technique] = line.split(' — ');
    if (!title || !technique) throw new Error(`Incomplete entry: ${line}`);
    return {
      id: `aprendizado-receita-${chapter + 1}-${String(i + 1).padStart(2, '0')}`,
      groupId: groups[chapter].id,
      title,
      difficulty: Math.floor(i / 5),
      time: '', servings: '', photo: null, ingredients: [], steps: [],
      notes: `Técnica a praticar: ${technique}` + (context ? `\n\nSobre a categoria: ${context}` : '')
    };
  });
});

// Fixed IDs make repeated Merge imports safe; retain the supplied outline,
// leaving quantities and methods empty instead of inventing recipe details.
const book = { app: 'recipe-book', version: 2, groups, recipes };
const output = new URL('../receitas-90.json', import.meta.url);
writeFileSync(output, JSON.stringify(book, null, 2) + '\n', 'utf8');
console.log(`Created receitas-90.json: ${groups.length} groups, ${recipes.length} recipes.`);
