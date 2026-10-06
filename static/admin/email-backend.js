(() => {
  const CMS = window.CMS;
  const h = window.h;
  const request = async (path, body) => {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    if (response.status === 401) throw new Error('Your session expired. Reload this page to receive a new email code.');
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'CMS request failed.');
    return result;
  };
  const EmailLogin = window.createClass({
    getInitialState() { return { error: '', busy: false }; },
    async login() {
      this.setState({ busy: true, error: '' });
      try {
        await request('/api/session');
        await request('/api/github/repos/alfredoh7/one-click-hugo-cms-f7fbf');
        await this.props.onLogin({ token: 'email-session' });
      } catch (error) { this.setState({ busy: false, error: error.message }); }
      finally { this.setState({ busy: false }); }
    },
    render() {
      return h('div', { style: { maxWidth: 420, margin: '80px auto', padding: 32, fontFamily: 'sans-serif' } },
        h('h1', null, 'AVC Content Manager'),
        h('p', null, 'Use your authorized email session to edit the website.'),
        h('button', { onClick: this.login, disabled: this.state.busy }, this.state.busy ? 'Signing in...' : 'Continue with email'),
        h('p', { role: 'alert' }, this.state.error));
    }
  });
  class EmailBackend {
    constructor(config, options) {
      const backend = CMS.getBackend('github').init(config, options);
      const authenticate = backend.authenticate.bind(backend);
      backend.authComponent = () => EmailLogin;
      backend.authenticate = async credentials => {
        await request('/api/session');
        const user = await authenticate(credentials);
        backend.api.persistFiles = async (dataFiles, mediaFiles, persistOptions) => {
          if (persistOptions.useWorkflow) throw new Error('Use Publish to save directly to the website.');
          const files = [...mediaFiles, ...dataFiles];
          const uploads = await Promise.all(files.map(async file => ({
            path: file.path.replace(/^\/+/, ''),
            content: file.toBase64 ? await file.toBase64() : await backend.api.toBase64(file.raw),
          })));
          const result = await request('/api/publish', { files: uploads, message: persistOptions.commitMessage });
          files.forEach(file => { file.sha = result.files.find(saved => saved.path === file.path.replace(/^\/+/, '')).sha; });
          return result;
        };
        backend.api.deleteFiles = (paths, message) => request('/api/publish', {
          files: paths.map(path => ({ path: path.replace(/^\/+/, ''), delete: true })), message,
        });
        return user;
      };
      const logout = backend.logout.bind(backend);
      backend.logout = () => {
        logout();
        window.location.assign('/cdn-cgi/access/logout');
      };
      return backend;
    }
  }
  CMS.registerBackend('cloudflare-email', EmailBackend);
  CMS.init();
})();
