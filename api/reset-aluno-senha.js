const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.replace('Bearer ', '');
    if (!idToken) return res.status(401).json({ error: 'Token ausente' });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const db = admin.firestore();

    const { alunoId, novaSenha } = req.body || {};
    if (!alunoId || !novaSenha || novaSenha.length < 6) {
      return res.status(400).json({ error: 'Informe alunoId e uma senha com pelo menos 6 caracteres' });
    }

    const alunoDoc = await db.collection('alunos').doc(alunoId).get();
    if (!alunoDoc.exists) return res.status(404).json({ error: 'Aluno não encontrado' });
    const aluno = alunoDoc.data();

    if (aluno.trainerId !== decoded.uid) {
      return res.status(403).json({ error: 'Você não tem permissão para alterar este aluno' });
    }

    await admin.auth().updateUser(aluno.uid, { password: novaSenha });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Erro ao redefinir senha' });
  }
};
