import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadLogo = async (req, res) => {
  try {
    console.log('📥 Requisição de upload recebida');
    console.log('📦 Arquivo:', req.file);

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    const logoPath = `/uploads/logos/${req.file.filename}`;
    
    console.log('✅ Logo salva com sucesso:', logoPath);

    return res.status(200).json({
      message: 'Logo enviada com sucesso!',
      logoUrl: logoPath,
      filename: req.file.filename
    });

  } catch (error) {
    console.error('❌ Erro no upload:', error);
    return res.status(500).json({
      error: 'Erro ao fazer upload da logo',
      details: error.message
    });
  }
};

export const deleteLogo = async (req, res) => {
  try {
    const { filename } = req.params;
    
    const filePath = path.join(__dirname, '../../uploads/logos', filename);

    console.log('🗑️ Tentando deletar:', filePath);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('✅ Logo deletada:', filename);
      return res.status(200).json({ message: 'Logo deletada com sucesso' });
    }

    return res.status(404).json({ error: 'Logo não encontrada' });

  } catch (error) {
    console.error('❌ Erro ao deletar logo:', error);
    return res.status(500).json({ 
      error: 'Erro ao deletar logo',
      details: error.message 
    });
  }
};