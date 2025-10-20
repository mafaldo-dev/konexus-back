# Usa uma imagem oficial do Node.js
FROM node:18-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependências primeiro
COPY package*.json ./

# Instala as dependências
RUN npm install --production

# Copia o restante do código da aplicação
COPY . .

# Define a variável de ambiente para produção
ENV NODE_ENV=production

# Expõe a porta usada pelo seu servidor
EXPOSE 3010

# Comando para iniciar o servidor
CMD ["node", "server/main.js"]
