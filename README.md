# Consulta Datasus (MS) — Paciente

Aplicação web local que consulta o cadastro de paciente no serviço estadual ligado ao Datasus (Mato Grosso do Sul) e exibe os dados em uma interface no navegador.

## Como funciona

1. **Backend (FastAPI)**  
   O arquivo `app.py` sobe um servidor HTTP que:
   - expõe a rota **`GET /api/paciente`**, recebendo **CNS** ou **CPF** (apenas um por consulta);
   - chama a API oficial no endereço  
     `https://core.saude.ms.gov.br/r2/web/datasus/index.php`  
     com `?cns=` (15 dígitos) ou `?cpf=` (11 dígitos);
   - **faz o papel de proxy**: o navegador fala só com o seu computador, evitando bloqueios de CORS da API externa;
   - trata **codificação** do JSON (UTF-8, Latin-1, etc.), porque a resposta às vezes mistura formatos e o parse puro falha.

2. **Frontend (pasta `static/`)**  
   A página de busca é servida em **`http://127.0.0.1:8000/`** (não abra o `index.html` direto do disco: isso **não** mostra a interface completa, porque o navegador precisa falar com o servidor). O CSS e o JavaScript vêm de **`/static/...`**. O usuário informa CNS ou CPF; a interface chama `/api/paciente` e monta os blocos (identificação, endereço, contato, documentos, etc.) com o JSON retornado.

3. **Fluxo resumido**  
   Navegador → `http://127.0.0.1:8000` → busca no servidor local → servidor consulta a API do MS → resposta exibida na tela.

## Requisitos

- **Python 3.10 ou superior** (recomendado; o código usa anotações `str | None`).
- Conexão com a **internet** (a consulta depende do serviço em `core.saude.ms.gov.br`).

## Instalação

Na pasta do projeto, crie o ambiente virtual (apenas na primeira vez) e instale as dependências:

**Windows (PowerShell ou CMD):**

```text
cd "C:\caminho\para\Informaçoes do paciente"
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

**Linux / macOS:**

```text
cd /caminho/para/o/projeto
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Como rodar a aplicação

### Opção A — Windows (atalho)

Com o ambiente virtual já criado e dependências instaladas, dê **duplo clique** em:

`iniciar.bat`

O script reinstala/atualiza dependências de forma silenciosa, tenta **abrir o navegador** após 2 segundos e inicia o servidor. Se a janela não abrir, use manualmente: [http://127.0.0.1:8000](http://127.0.0.1:8000)

### Opção B — Linha de comando (Windows)

Com a pasta do projeto como diretório atual e o `venv` ativado:

```text
uvicorn app:app --host 127.0.0.1 --port 8000
```

### Opção C — Sem ativar o `venv` (Windows)

A partir da pasta do projeto:

```text
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

### Outra porta

Se a **8000** estiver em uso, use outra, por exemplo **8001**:

```text
uvicorn app:app --host 127.0.0.1 --port 8001
```

E acesse: [http://127.0.0.1:8001](http://127.0.0.1:8001)

### Modo desenvolvimento (recarregar ao salvar o código)

```text
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

## Uso no navegador

1. Acesse a URL exibida pelo servidor (por padrão `http://127.0.0.1:8000`). **Não** abra o arquivo `static\index.html` com duplo clique (caminho `file:///...`); a busca e o layout completo exigem o servidor.
2. Selecione **CNS** ou **CPF** (só um campo ativo). O CPF recebe **máscara** e o contador mostra a quantidade de dígitos. **Enter** submete; com foco no bloco de busca (título, radios, campos, botões), **Esc** limpa formulário e resultado.
3. Uma **segunda consulta** cancela a requisição anterior. Após o sucesso, o aviso *Consulta concluída* aparece; dá para **copiar** CPF e CNS (Identificação), abrir **telefone** e **e-mail** como link, usar **Nova consulta** (vai para o campo) ou **Ocultar dados** (só a área do paciente, sem apagar o que digitou). Enquanto carrega, vê-se o **esqueleto**; depois, **cabeçalho** (nome em `h2`) e **abas** — setas **←/→** na lista de abas.
4. Se não houver registro, a API responde com mensagem apropriada.

## Se a tela em branco ou a página de erro persistirem

- Confirme que o **Uvicorn está rodando** (janela do terminal aberta, sem tracebacks em vermelho). Erros ao importar módulos costumam indicar `pip install -r requirements.txt` faltando ou `venv` incorreto.
- Use exatamente **`http://127.0.0.1:8000`** ou **`http://localhost:8000`**, nunca `file:///C:/.../index.html`.
- Se a porta 8000 estiver ocupada, use outra porta (seção *Outra porta* acima) e o mesmo endereço com essa porta.
- Teste se o HTML carrega: no navegador, abra o **código fonte** (Ctrl+U) e veja se o link do CSS aponta para `/static/styles.css` (a página devida precisa de CSS no mesmo domínio do servidor).

## API local (para integrações / testes)

- **CNS:**  
  `GET http://127.0.0.1:8000/api/paciente?cns=708000392876825`

- **CPF:**  
  `GET http://127.0.0.1:8000/api/paciente?cpf=05460745101`

Resposta: um objeto JSON com os campos fornecidos pelo serviço (não documentados aqui em detalhe, pois dependem do backend estadual).

## Estrutura de pastas (principal)

| Item | Descrição |
|------|------------|
| `app.py` | Servidor FastAPI e proxy para a API do MS |
| `static/index.html` | Página da interface |
| `static/styles.css` | Estilos |
| `static/app.js` | Lógica da busca e exibição |
| `requirements.txt` | Dependências Python |
| `iniciar.bat` | Início rápido no Windows |

## Privacidade e responsabilidade

Os dados exibidos são de **saúde e identificação** e estão sujeitos à **LGPD**. Use apenas em **contexto autorizado** (por exemplo, atendimento, função pública com competência) e com medidas técnicas e organizacionais adequadas. A disponibilidade e o formato do serviço `core.saude.ms.gov.br` podem **mudar** sem aviso; nesse caso pode ser necessário ajustar `BASE_URL` ou o tratamento da resposta em `app.py`.

## Encerrar o servidor

No terminal em que o Uvicorn estiver rodando, use **Ctrl+C**.
