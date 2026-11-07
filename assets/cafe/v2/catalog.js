// Fonte Única da Verdade — Catálogo e Geometria da Cafeteria (v2)
// Qualquer atualização de imagem ou item aqui reflete automaticamente no mockup e no motor do jogo (preview-cafeteria.html).

window.CAFE_V2 = {
  T: 31,
  K: 0.573, // Projeção isométrica real de 30°

  floors: {
    cimento:   { id: 'cimento',   nm: 'Piso cimento gasto',   src: 'piso_cimento.jpg',   price: 'tem', lv: 1, edgeL: '#7B736A', edgeR: '#91887E' },
    liso:      { id: 'liso',      nm: 'Piso cimento liso',    src: 'piso_liso.jpg',      price: 50,    lv: 1, edgeL: '#8A8177', edgeR: '#A3998E' },
    areia:     { id: 'areia',     nm: 'Porcelanato areia',    src: 'piso_areia.jpg',     price: 65,    lv: 1, edgeL: '#9E8E78', edgeR: '#B5A48C' },
    terracota: { id: 'terracota', nm: 'Lajota terracota',     src: 'piso_terracota.jpg', price: 80,    lv: 1, edgeL: '#8C442A', edgeR: '#A85234' },
    xadrez:    { id: 'xadrez',    nm: 'Piso xadrez retrô',    src: 'piso_xadrez.jpg',    price: 90,    lv: 2, edgeL: '#7D422A', edgeR: '#9E5436' },
    madeira:   { id: 'madeira',   nm: 'Piso taco madeira',    src: 'piso_madeira.jpg',   price: 120,   lv: 2, edgeL: '#7D4B2A', edgeR: '#985E36' },
    espinha:   { id: 'espinha',   nm: 'Parquet espinha',      src: 'piso_espinha.jpg',   price: 140,   lv: 3, edgeL: '#8A5632', edgeR: '#A4683E' },
    ardosia:   { id: 'ardosia',   nm: 'Ardósia grafite',      src: 'piso_ardosia.jpg',   price: 150,   lv: 3, edgeL: '#3E4246', edgeR: '#4E5256' }
  },

  walls: {
    reboco:    { id: 'reboco',    nm: 'Parede reboco gasto',  src: 'parede_reboco.jpg',    price: 'tem', lv: 1, top: '#D8CCB8', sideL: '#9B8E7B', sideR: '#B2A490' },
    creme:     { id: 'creme',     nm: 'Pintura creme',        src: 'parede_creme.jpg',     price: 50,    lv: 1, top: '#E5D6BE', sideL: '#9A6038', sideR: '#B47447' },
    salvia:    { id: 'salvia',    nm: 'Verde sálvia sólido',  src: 'parede_salvia.jpg',    price: 70,    lv: 1, top: '#A8C0AA', sideL: '#6E8470', sideR: '#829A84' },
    terracota: { id: 'terracota', nm: 'Terracota sólido',     src: 'parede_terracota.jpg', price: 80,    lv: 1, top: '#D89274', sideL: '#9E583C', sideR: '#B4684A' },
    tijolo:    { id: 'tijolo',    nm: 'Parede tijolinho',     src: 'parede_tijolo.jpg',    price: 100,   lv: 2, top: '#8A4932', sideL: '#633221', sideR: '#7A3E29' },
    metro:     { id: 'metro',     nm: 'Azulejo metrô creme',  src: 'parede_metro.jpg',     price: 115,   lv: 2, top: '#E4CEB0', sideL: '#8A532F', sideR: '#A6683C' },
    lambri:    { id: 'lambri',    nm: 'Parede c/ lambri',     src: 'parede_lambri.jpg',    price: 120,   lv: 2, top: '#D8B48A', sideL: '#8A532F', sideR: '#A6683C' },
    azul:      { id: 'azul',      nm: 'Azul petróleo sólido', src: 'parede_azul.jpg',      price: 135,   lv: 3, top: '#5C7E8C', sideL: '#364C56', sideR: '#425C68' },
    espresso:  { id: 'espresso',  nm: 'Boiserie torra escura',src: 'parede_espresso.jpg',  price: 160,   lv: 3, top: '#684836', sideL: '#3A261C', sideR: '#4A3224' }
  },

  sprites: {
    // Bancadas, Móveis & Prateleiras
    caixote:           { nm: 'Caixote feira (1×1)',  cat: 'moveis',  src: 'caixote_feira.png',     price: 'tem', lv: 1, w: 1, d: 1, topZ: 42, iw: 640, ih: 883, ax: 320, ay: 879, sc: (1.78 * 31) / 640 },
    carrinho:          { nm: 'Carrinho caixote',     cat: 'moveis',  src: 'carrinho_caixote.png',  price: 35,    lv: 1, w: 1, d: 1, topZ: 42, iw: 758, ih: 1017, ax: 365, ay: 1008, sc: (1.78 * 31) / 680 },
    bancada_simples:   { nm: 'Bancada pinus (2×1)',  cat: 'moveis',  src: 'bancada_simples.png',   price: 65,    lv: 1, w: 2, d: 1, topZ: 36, iw: 831, ih: 813, ax: 577, ay: 805, sc: (2 * 31) / 570 },
    prateleira_parede: { nm: 'Prateleira parede',    cat: 'moveis',  src: 'prateleira_parede.png', price: 75,    lv: 1, place: 'wall', topZ: 1, iw: 831, ih: 668, ax: 500, ay: 200, sc: (1.85 * 31) / 831 },
    mesa_bistro:       { nm: 'Mesa bistrô (1×1)',    cat: 'moveis',  src: 'mesa_bistro.png',       price: 95,    lv: 2, w: 1, d: 1, topZ: 36, centerBase: true, iw: 425, ih: 530, ax: 212, ay: 505, sc: (1.28 * 31) / 425 },
    balcao:            { nm: 'Balcão madeira (2×1)', cat: 'moveis',  src: 'balcao_reto.png',       price: 120,   lv: 2, w: 2, d: 1, topZ: 36, iw: 831, ih: 813, ax: 577, ay: 805, sc: (2 * 31) / 570 },
    industrial:        { nm: 'Balcão industrial',    cat: 'moveis',  src: 'balcao_industrial.png', price: 150,   lv: 2, w: 2, d: 1, topZ: 36, iw: 831, ih: 813, ax: 577, ay: 805, sc: (2 * 31) / 570 },
    vitrola_cafe:      { nm: 'Vitrola & vinis (1×1)',cat: 'moveis',  src: 'vitrola_cafe.png',      price: 165,   lv: 2, w: 1, d: 1, iw: 435, ih: 691, ax: 242, ay: 682, sc: (1.35 * 31) / 435 },
    poltrona_cafe:     { nm: 'Poltrona caramelo',    cat: 'moveis',  src: 'poltrona_cafe.png',     backSrc: 'poltrona_cafe_back.png', backIw: 501, backIh: 552, backAx: 260, backAy: 547, backSc: (1.48 * 31) / 501, price: 180, lv: 3, w: 1, d: 1, iw: 724, ih: 885, ax: 405, ay: 880, sc: (1.48 * 31) / 724 },
    balcao_vitrine:    { nm: 'Balcão c/ vitrine',    cat: 'moveis',  src: 'balcao_vitrine.png',    price: 240,   lv: 3, w: 2, d: 1, topZ: 36, iw: 945, ih: 939, ax: 685, ay: 931, sc: (2 * 31) / 655 },
    sofa_couro:        { nm: 'Sofá caramelo (2×1)',  cat: 'moveis',  src: 'sofa_couro.png',        backSrc: 'sofa_couro_back.png',    backIw: 671, backIh: 633, backAx: 423, backAy: 628, backSc: (2.52 * 31) / 671, price: 260, lv: 3, w: 2, d: 1, iw: 829, ih: 866, ax: 560, ay: 860, sc: (2.52 * 31) / 829 },
    estante_alta:      { nm: 'Estante barista alta', cat: 'moveis',  src: 'estante_alta.png',      price: 320,   lv: 4, w: 2, d: 1, tall: true, iw: 671, ih: 956, ax: 468, ay: 948, sc: (2 * 31) / 454 },

    // Equipamentos de Barista & Grãos
    pacote_cafe:       { nm: 'Pacote café grãos',    cat: 'barista', src: 'pacote_cafe.png',       price: 25,    lv: 1, iw: 393, ih: 718, ax: 196, ay: 650, sc: 19 / 718 },
    pote_graos:        { nm: 'Pote de grãos',        cat: 'barista', src: 'pote_graos.png',        price: 30,    lv: 1, iw: 387, ih: 684, ax: 193, ay: 620, sc: 18 / 684 },
    balanca:           { nm: 'Balança digital',      cat: 'barista', src: 'balanca.png',           price: 40,    lv: 1, iw: 832, ih: 789, ax: 416, ay: 630, sc: 19 / 789 },
    chaleira:          { nm: 'Chaleira bico ganso',  cat: 'barista', src: 'chaleira.png',          price: 50,    lv: 1, iw: 433, ih: 348, ax: 216, ay: 280, sc: 19 / 348 },
    moedor_manual:     { nm: 'Moedor a manivela',    cat: 'barista', src: 'moedor_manual.png',     price: 55,    lv: 1, iw: 829, ih: 904, ax: 415, ay: 740, sc: 21 / 904 },
    moedor_eletrico:   { nm: 'Moedor elétrico',      cat: 'barista', src: 'moedor_eletrico.png',   price: 130,   lv: 2, iw: 766, ih: 837, ax: 385, ay: 675, sc: 25 / 837 },
    maquina_espresso:  { nm: 'Máquina de espresso',  cat: 'barista', src: 'maquina_espresso.png',  price: 280,   lv: 3, iw: 925, ih: 961, ax: 480, ay: 785, sc: 54 / 961 },
    torrador_cafe:     { nm: 'Torrador artesanal',   cat: 'barista', src: 'torrador_cafe.png',     price: 350,   lv: 4, place: 'floor', w: 1, d: 1, iw: 446, ih: 747, ax: 185, ay: 738, sc: (2.15 * 31) / 446 },

    // Métodos de Preparo
    coador:            { nm: 'Coador de pano',       cat: 'metodos', src: 'coador_pano.png',       price: 'tem', lv: 1, iw: 501, ih: 824, ax: 235, ay: 805, sc: 26 / 824 },
    v60:               { nm: 'Hario V60',            cat: 'metodos', src: 'metodo_v60.png',        price: 45,    lv: 1, iw: 495, ih: 769, ax: 248, ay: 755, sc: 22 / 769 },
    prensa:            { nm: 'Prensa francesa',      cat: 'metodos', src: 'prensa.png',            price: 60,    lv: 1, iw: 272, ih: 445, ax: 136, ay: 432, sc: 22 / 445 },
    moka:              { nm: 'Moka italiana',        cat: 'metodos', src: 'moka.png',              price: 75,    lv: 2, iw: 306, ih: 427, ax: 145, ay: 416, sc: 22 / 427 },
    chemex:            { nm: 'Chemex',               cat: 'metodos', src: 'chemex.png',            price: 95,    lv: 2, iw: 249, ih: 431, ax: 125, ay: 420, sc: 22 / 431 },

    // Decoração, Quadros, Placas, Iluminação & Janela
    planta:            { nm: 'Vaso suculenta',       cat: 'decor',   src: 'planta_pequena.png',    price: 30,    lv: 1, canPlaceOnFloor: true, centerBase: true, w: 1, d: 1, iw: 537, ih: 735, ax: 268, ay: 730, sc: 25 / 735 },
    quadro_grao:       { nm: 'Quadro grão 3D',       cat: 'decor',   src: 'quadro_grao.png',       price: 35,    lv: 1, iso3d: true, iw: 396, ih: 780, ax: 215, ay: 390, sc: 25 / 396 },
    lousa_parede:      { nm: 'Lousa de café 3D',     cat: 'decor',   src: 'lousa_parede.png',      price: 45,    lv: 1, iso3d: true, iw: 402, ih: 780, ax: 220, ay: 390, sc: 31 / 402 },
    poster_botanico:   { nm: 'Pôster botânico 3D',   cat: 'decor',   src: 'poster_botanico.png',   price: 50,    lv: 1, place: 'wall', iso3d: true, iw: 397, ih: 780, ax: 215, ay: 390, sc: 26 / 397 },
    placa_cavalete:    { nm: 'Placa cavalete',       cat: 'decor',   src: 'placa_cavalete.png',    price: 55,    lv: 1, place: 'floor', centerBase: true, w: 1, d: 1, iw: 631, ih: 862, ax: 315, ay: 845, sc: (1.25 * 31) / 631 },
    arandela_parede:   { nm: 'Arandela de parede',   cat: 'decor',   src: 'arandela_parede.png',   price: 60,    lv: 2, place: 'wall', iso3d: true, iw: 624, ih: 774, ax: 485, ay: 185, sc: 32 / 774 },
    luminaria:         { nm: 'Luminária pendente',   cat: 'decor',   src: 'luminaria_teto.png',    price: 60,    lv: 2, iw: 560, ih: 874, ax: 280, ay: 12,  sc: 38 / 874 },
    placa_parede_cafe: { nm: 'Placa dourada 3D',     cat: 'decor',   src: 'placa_parede_cafe.png', price: 65,    lv: 2, place: 'wall', iso3d: true, iw: 394, ih: 782, ax: 215, ay: 390, sc: 26 / 394 },
    janela:            { nm: 'Janela madeira 3D',    cat: 'decor',   src: 'janela.png',            price: 70,    lv: 2, iso3d: true, iw: 770, ih: 1058, ax: 430, ay: 550, sc: 58 / 770 },
    tapete_entrada:    { nm: 'Tapete de café (2×1)', cat: 'decor',   src: 'tapete_entrada.png',    price: 85,    lv: 2, place: 'floor', isRug: true, centerBase: true, w: 2, d: 1, iw: 639, ih: 386, ax: 320, ay: 193, sc: (3 * 31) / 639 },
    planta_chao:       { nm: 'Costela-de-Adão',      cat: 'decor',   src: 'planta_chao.png',       price: 95,    lv: 2, place: 'floor', centerBase: true, w: 1, d: 1, iw: 408, ih: 738, ax: 204, ay: 725, sc: (1.30 * 31) / 408 }
  }
};
