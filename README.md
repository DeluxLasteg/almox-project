# 📦 Sistema de Almoxarifado & Controle de Estoque

> Um sistema web completo para gestão de almoxarifado e ponto de venda (PDV), desenvolvido do zero com foco em usabilidade, persistência de dados em nuvem e eficiência no controle de inventário.

## 💻 Sobre o Projeto

Este projeto nasceu do desejo de criar uma solução prática e funcional para o controle de mercadorias. O sistema permite o gerenciamento completo de um almoxarifado, oferecendo desde a entrada e saída de produtos até um dashboard interativo para visualização de métricas em tempo real.

Todo o desenvolvimento lógico e estrutural foi construído com o auxílio de Inteligência Artificial, servindo como uma excelente base de aplicação prática de conceitos de Full Stack, migrando de um armazenamento local para um banco de dados robusto na nuvem.

## ✨ Funcionalidades Principais

* **Gestão de Produtos:** Cadastro, edição, exclusão e visualização de itens no estoque.
* **Controle de Movimentação:** Registro detalhado de entradas e saídas de mercadorias.
* **Painel de Controle (Dashboard):** Visão geral rápida dos níveis de estoque e estatísticas importantes.
* **Controle de Acesso:** Diferentes níveis de permissão para usuários do sistema.
* **Integração em Nuvem:** Dados persistidos de forma segura e sincronizada entre diferentes dispositivos.
* **Interface Responsiva e Intuitiva:** Layout desenhado para facilitar a operação diária.

## 🛠️ Tecnologias Utilizadas

**Front-end:**
* **HTML5:** Estruturação semântica de toda a aplicação.
* **CSS3:** Estilização, layout e responsividade.
* **JavaScript (Vanilla):** Lógica de interface, manipulação do DOM e regras de negócio.

**Back-end & Banco de Dados:**
* **Supabase:** Plataforma Backend-as-a-Service (BaaS) utilizada para armazenamento e gerenciamento do banco de dados na nuvem, garantindo segurança e persistência.

## 🚀 Como Executar o Projeto

Como a aplicação roda diretamente no navegador e consome serviços em nuvem, rodar o projeto localmente é bem simples:

1. Clone este repositório para a sua máquina local:
   ```bash
   git clone https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git
   cd NOME_DO_REPOSITORIO
   ```
2. Abra o arquivo `index.html` no navegador ou inicie um servidor local para uma experiência mais estável:
   ```bash
   python3 -m http.server 8000
   ```
3. Acesse a aplicação em:
   ```text
   http://localhost:8000
   ```
4. Configure as credenciais do Supabase no código front-end (`SUPABASE_URL` e `SUPABASE_ANON_KEY`) para conectar ao banco de dados na nuvem.

## 📌 Observações

* Substitua `SEU_USUARIO` e `NOME_DO_REPOSITORIO` pelo caminho correto do seu repositório GitHub.
* Garanta que seu projeto contenha os arquivos estáticos do front-end e a configuração do Supabase para que a aplicação funcione corretamente.
* Caso utilize outra ferramenta de servidor local, como `serve` ou `live-server`, o procedimento também é válido.

🧠 Desenvolvimento e Aprendizado
Este repositório marca um passo importante na minha jornada como desenvolvedor. Utilizar IA como ferramenta de suporte na engenharia de prompts me permitiu acelerar o aprendizado, entender lógicas complexas de JavaScript e realizar a integração de uma interface web com um banco de dados real na nuvem.

## Desenvolvido por Alan Freitas (Delux Lasteg).
