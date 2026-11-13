# Conexões SI

Mapa interativo das disciplinas e possibilidades de carreira do Bacharelado em Sistemas de Informação do IFMG, campus Ouro Branco. É um projeto estudantil independente.

[Abrir demonstração no GitHub Pages](https://vitorhrm.github.io/SADtrab/)

## O que explorar

- Disciplinas obrigatórias e optativas, organizadas por período.
- Relações entre disciplinas e carreiras, com comparação e favoritos.
- Sugestões baseadas nas matérias selecionadas, com três pontos para vínculos diretos e um ponto para matérias de apoio.

## Executar

Abra [`index.html`](index.html) em um navegador. Para testar com um servidor local, execute na raiz do projeto:

```sh
python -m http.server 8000
```

Acesse [http://localhost:8000](http://localhost:8000). O projeto usa HTML, CSS e JavaScript e dispensa compilação.

## Dados e critérios

- [`data.js`](data.js) contém os dados carregados pela interface.
- [`dados.json`](dados.json) oferece os dados em formato exportável. Ao editar o catálogo, confira os dois arquivos.
- [`app.js`](app.js) controla a interface e [`discovery.js`](discovery.js) reúne a lógica de exploração.

A seção **Fontes** da interface reúne o PPC, o ementário e a matriz curricular, incluindo notas sobre divergências entre os documentos. As relações de carreira foram organizadas para a ferramenta. Consulte a coordenação para saber qual matriz se aplica à sua turma.
