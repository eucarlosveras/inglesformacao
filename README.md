# Inglês em Formação

Plataforma de estudos de inglês em três níveis, do zero ao avançado, guiada pelos livros da série *Grammar in Use* (Cambridge).

**Acesse:** https://eucarlosveras.github.io/inglesformacao/

| Nível | CEFR | Livro | Módulos | Unidades |
|---|---|---|---|---|
| Inicial | A1–A2 | *Essential Grammar in Use*, Raymond Murphy | 20 | 114 |
| Intermediário | B1–B2 | *English Grammar in Use* (4ª ed.), Raymond Murphy | 16 | 145 |
| Avançado | C1–C2 | *Advanced Grammar in Use* (2ª ed.), Martin Hewings | 14 | 100 |

## O que tem em cada módulo

- Explicação em português, escrita para a plataforma
- Exemplos com tradução e áudio (leitura em voz alta do navegador)
- Erros comuns de quem fala português
- 12 exercícios de lacuna corrigidos na hora (600 no total)
- Quiz de múltipla escolha e flashcards
- Lista das unidades do livro, com página e botão que abre o PDF na página certa
- Anotações pessoais

Também tem teste de nivelamento, busca, painel de progresso, ofensiva diária, XP, modo noturno, modo foco e backup do progresso em arquivo.

## Progresso na nuvem (Supabase)

O progresso fica salvo no navegador (`localStorage`) e é sincronizado com o Supabase (projeto `apostila-analista-dados`, o mesmo do analisadedadosformacao), na tabela `public.english_progress`: uma linha por usuário com o estado completo em `jsonb`, protegida por RLS (cada usuário só acessa a própria linha).

- Ao abrir o site, é criada uma conta anônima automaticamente e o progresso já vai para a nuvem.
- Em *Progresso → Sincronização na nuvem*, vincule um e-mail para usar em outros aparelhos. O link de acesso chega por e-mail.
- Quando o progresso local é de outra conta ou de outro aparelho, os dois são somados em vez de sobrescritos.
- Se o Supabase estiver fora do ar, tudo continua funcionando só com o armazenamento local.

## Os livros (PDF)

Os PDFs **não fazem parte do repositório**: são material com direitos autorais e passam do limite de tamanho do GitHub.

- **Rodando localmente:** coloque os PDFs na mesma pasta do `index.html`, com os nomes abaixo, e os botões "PDF p." abrem direto.
  - `Essential Grammar in Use - Raymond Murphy - Inicial.pdf`
  - `English Grammar in Use - Raymond Murphy - Intermediario.pdf`
  - `Advanced Grammar in Use - Martin Hewings - Avancado.pdf`
- **No site publicado:** em *Níveis → Meus livros (PDF)*, carregue cada arquivo uma vez. Ele fica guardado só no seu navegador (IndexedDB).

## Estrutura

```
index.html               página única (rotas por hash: #/inicio, #/nivel/..., #/modulo/...)
css/style.css            visual (mesmo design system do analisadedadosformacao)
js/app.js                lógica: trilha, módulos, quiz, flashcards, XP, PDFs
js/data-inicial.js       conteúdo do nível Inicial
js/data-intermediario.js conteúdo do nível Intermediário
js/data-avancado.js      conteúdo do nível Avançado
js/data-exercicios.js    exercícios extras de cada módulo (somados aos dos arquivos acima)
```

Para editar o conteúdo, altere os arquivos `js/data-*.js`. Cada módulo tem `t` (título), `u` (faixa de unidades), `intro`, `pts` (explicação), `ex` (exemplos), `trap` (erros comuns), `drill` (lacunas; respostas alternativas separadas por `|`), `quiz` e `cards`.
