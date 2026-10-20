import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
}

export default tseslint.config(
  { ignores: ['dist', 'public', 'scripts/__fixtures__', 'node_modules'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  // `const { a, ...rest } = x` is how this codebase omits keys
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }] } },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['scripts/**', 'vite.config.ts'],
    languageOptions: { globals: nodeGlobals },
  },
)
