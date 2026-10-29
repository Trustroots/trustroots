import 'bootstrap/dist/css/bootstrap.min.css';
import '../client/styles/main.less';
import '../client/styles/tailwind.css';

// Vite turns import.meta.glob into static imports and prepends them. Keeping
// that glob in its own module, imported after Bootstrap, ensures later app
// rules win when specificity ties.
import './load-module-styles.ts';
