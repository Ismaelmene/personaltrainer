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

    const callerDoc = await db.collection('users').doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== 'personal') {
      return res.status(403).json({ error: 'Apenas personal trainers podem cadastrar alunos' });
    }

    const { nome, email, senha, telefone, dataNascimento, objetivo, mensalidadeValor, diaVencimento } = req.body || {};
    if (!nome || !email || !senha || senha.length < 6) {
      return res.status(400).json({ error: 'Nome, email e senha (mín. 6 caracteres) são obrigatórios' });
    }

    const userRecord = await admin.auth().createUser({ email, password: senha, displayName: nome });

    await db.collection('users').doc(userRecord.uid).set({
      role: 'aluno',
      name: nome,
      email,
      trainerId: decoded.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const alunoRef = await db.collection('alunos').add({
      uid: userRecord.uid,
      trainerId: decoded.uid,
      nome,
      email,
      telefone: telefone || '',
      dataNascimento: dataNascimento || '',
      objetivo: objetivo || '',
      ativo: true,
      mensalidade: {
        valor: Number(mensalidadeValor) || 0,
        diaVencimento: Number(diaVencimento) || 5
      },
      treino: { updatedAt: null, dias: [] },
      dieta: { updatedAt: null, refeicoes: [], restricoes: '', observacoesGerais: '', caloriasAlvo: '' },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, alunoId: alunoRef.id, uid: userRecord.uid });
  } catch (err) {
    console.error(err);
    if (err.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Este email já está cadastrado' });
    }
    return res.status(500).json({ error: err.message || 'Erro ao criar aluno' });
  }
};
