const fs = require('fs');
const path = require('path');

const files = [
  'Workspace.jsx',
  'VariablesManager.jsx',
  'WesternBlot.jsx',
  'PlateMapper.jsx',
  'Dashboard.jsx',
  'CellCulture.jsx'
];

files.forEach(f => {
  const p = path.join(__dirname, 'src', 'components', f);
  let content = fs.readFileSync(p, 'utf8');
  
  content = content.replace(/setState\(\{ \.\.\.state, /g, 'updateState({ ');
  content = content.replace(/setState\(\{\.\.\.state, /g, 'updateState({ '); // In case of missing space
  content = content.replace(/\{ state, setState \}/g, '{ state, updateState }');
  content = content.replace(/\{ state, setActiveTab, setState, showToast \}/g, '{ state, setActiveTab, updateState, showToast }');
  
  if (f === 'WesternBlot.jsx') {
    content = content.replace(
      /export default function WesternBlot\(\{ state, updateState \}\) \{/,
      `export default function WesternBlot({ subjects = [], variables = [], updateState }) {\n  const state = { subjects, variables }; // Compatibility shim for internal state.subjects/state.variables reads`
    );
  }

  fs.writeFileSync(p, content, 'utf8');
});
