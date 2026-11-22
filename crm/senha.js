/* Troca obrigatória de senha no próximo acesso.
   Quando o perfil vem com trocar_senha = true (o admin ligou, ou gerou uma senha provisória), a pessoa só entra depois de criar a própria senha.
   Uso: await XYZSenha.exigir(sb, perfil)  →  resolve quando a senha foi trocada (ou na hora, se não há o que trocar).
   A senha nova vai direto do navegador para o serviço de login; não passa pelo banco da XYZ nem fica guardada em tela nenhuma. */
(function (root) {
  const FRACAS = /^(xyz|senha|abc|qwe|1234|4321|0000|1111)/i;
  function avaliar(s, perfil) {
    const nome = String((perfil && perfil.nome) || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/)[0];
    const t = String(s || '');
    if (t.length < 8) return 'Use pelo menos 8 caracteres.';
    if (!/[a-zA-Z]/.test(t) || !/\d/.test(t)) return 'Misture letras e números.';
    if (FRACAS.test(t) || /^(.)\1+$/.test(t)) return 'Essa é fácil demais de adivinhar. Escolha outra.';
    if (nome && nome.length >= 3 && t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(nome)) return 'Não use o seu nome na senha.';
    return '';
  }
  function exigir(sb, perfil) {
    if (!perfil || !perfil.trocar_senha) return Promise.resolve(false);
    return new Promise(function (ok) {
      const cx = document.createElement('div');
      cx.setAttribute('role', 'dialog'); cx.setAttribute('aria-modal', 'true'); cx.setAttribute('aria-label', 'Criar senha nova');
      cx.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,15,.92);display:grid;place-items:center;padding:18px;font-family:Inter,system-ui,sans-serif';
      cx.innerHTML = '<form style="width:100%;max-width:400px;background:#071430;border:1px solid rgba(251,191,36,.45);border-radius:16px;padding:24px;color:#eaf3ff">'
        + '<h2 style="margin:0 0 6px;font-size:19px">Crie a sua senha</h2>'
        + '<p style="margin:0 0 16px;font-size:13.5px;line-height:1.5;color:#93a9c9">A senha que você usou para entrar é provisória. Escolha uma só sua: daqui em diante só você entra com ela.</p>'
        + '<label style="display:block;font-size:12px;color:#93a9c9;margin-bottom:5px">Senha nova</label>'
        + '<input type="password" id="xs-1" autocomplete="new-password" style="width:100%;background:rgba(2,8,22,.7);border:1px solid rgba(30,144,255,.35);border-radius:10px;padding:11px 12px;color:#eaf3ff;font:inherit;outline:none;margin-bottom:12px">'
        + '<label style="display:block;font-size:12px;color:#93a9c9;margin-bottom:5px">Repita a senha</label>'
        + '<input type="password" id="xs-2" autocomplete="new-password" style="width:100%;background:rgba(2,8,22,.7);border:1px solid rgba(30,144,255,.35);border-radius:10px;padding:11px 12px;color:#eaf3ff;font:inherit;outline:none">'
        + '<label style="display:flex;gap:8px;align-items:center;font-size:12.5px;color:#93a9c9;margin:10px 0 0;cursor:pointer"><input type="checkbox" id="xs-ver" style="width:auto"> mostrar o que estou digitando</label>'
        + '<div id="xs-erro" style="color:#fca5a5;font-size:13px;min-height:20px;margin:10px 0 6px"></div>'
        + '<button id="xs-ok" style="width:100%;background:linear-gradient(135deg,#b8860b,#fbbf24 60%,#fde68a);color:#1a1205;border:0;border-radius:10px;padding:12px;font-weight:700;font:inherit;font-weight:700;cursor:pointer">Salvar e entrar</button>'
        + '<p style="margin:12px 0 0;font-size:12px;color:#93a9c9;line-height:1.5">Pelo menos 8 caracteres, com letras e números. Não use o seu nome.</p></form>';
      document.body.appendChild(cx);
      const f = cx.querySelector('form'), a = cx.querySelector('#xs-1'), b = cx.querySelector('#xs-2'), er = cx.querySelector('#xs-erro'), bt = cx.querySelector('#xs-ok');
      cx.querySelector('#xs-ver').onchange = function (e) { a.type = b.type = e.target.checked ? 'text' : 'password'; };
      setTimeout(function () { a.focus(); }, 50);
      f.onsubmit = async function (e) {
        e.preventDefault(); er.textContent = '';
        const msg = avaliar(a.value, perfil) || (a.value !== b.value ? 'As duas senhas não estão iguais.' : '');
        if (msg) { er.textContent = msg; return; }
        bt.disabled = true; bt.textContent = 'Salvando…';
        try {
          const r = await sb.auth.updateUser({ password: a.value });
          if (r.error) throw r.error;
          const r2 = await sb.rpc('senha_trocada'); if (r2.error) throw r2.error;
          a.value = b.value = ''; cx.remove(); perfil.trocar_senha = false; ok(true);
        } catch (err) {
          const m = String((err && err.message) || err);
          er.textContent = /different from the old|same/i.test(m) ? 'A senha nova precisa ser diferente da provisória.' : /weak|pwned|leaked|should be at least/i.test(m) ? 'O sistema recusou essa senha por ser fraca ou conhecida. Escolha outra.' : 'Não consegui salvar: ' + m;
          bt.disabled = false; bt.textContent = 'Salvar e entrar';
        }
      };
    });
  }
  root.XYZSenha = { exigir: exigir, avaliar: avaliar };
  if (typeof module !== 'undefined') module.exports = root.XYZSenha;
})(typeof window !== 'undefined' ? window : globalThis);
