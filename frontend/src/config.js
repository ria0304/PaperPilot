export const PW = 1240;
export const PH = 1754;
export const MMPX = PW / 210;
export const mm = (v) => v * MMPX;

export const FONTS = [
  { n: 'Caveat', k: 1.22, tag: 'Student' },
  { n: 'Kalam', k: 0.9, tag: 'Neat' },
  { n: 'Patrick Hand', k: 1.0, tag: 'Print' },
  { n: 'Indie Flower', k: 0.92, tag: 'Round' },
  { n: 'Shadows Into Light', k: 1.05, tag: 'Quick' },
  { n: 'Reenie Beanie', k: 1.4, tag: 'Slightly messy' },
  { n: 'Nanum Pen Script', k: 1.3, tag: 'Slim' },
  { n: 'Covered By Your Grace', k: 1.25, tag: 'Loose' },
  { n: 'La Belle Aurore', k: 1.0, tag: 'Neat cursive' },
  { n: 'Homemade Apple', k: 0.62, tag: 'Wide cursive' },
];

export const INKS = [
  { id: 'blue', c: '#1d3dbf', name: 'Blue' },
  { id: 'black', c: '#18181d', name: 'Black' },
  { id: 'bb', c: '#1b2a66', name: 'Blue-black' },
  { id: 'red', c: '#c3262d', name: 'Red' },
  { id: 'pencil', c: '#5a5d66', name: 'Pencil' },
];

export const PAPERS = [
  { id: 'ruled', name: 'Ruled' },
  { id: 'plain', name: 'Plain' },
  { id: 'graph', name: 'Graph' },
  { id: 'dotted', name: 'Dotted' },
  { id: 'eng', name: 'Engineering' },
  { id: 'custom', name: 'Custom' },
];

export const SAMPLE_Q =
  'Explain the working of a Binary Search Tree with an example.';
export const SAMPLE_A = [
  '# Binary Search Tree (BST)',
  '',
  'A Binary Search Tree is a binary tree in which every node stores a key and follows one ordering rule. All keys in the left subtree are smaller than the node, and all keys in the right subtree are larger.',
  '',
  '## Properties',
  '- Each node has at most two children, a left child and a right child.',
  '- The left subtree holds only smaller keys.',
  '- The right subtree holds only larger keys.',
  '- An inorder traversal visits the keys in sorted order.',
  '',
  '## Example',
  'Insert the keys 50, 30, 70, 20, 40, 60, 80 in this order.',
  '[bst 50 30 70 20 40 60 80]',
  '',
  '## Working',
  '1. 50 becomes the root because the tree is empty.',
  '2. 30 is smaller than 50, so it goes to the left of 50.',
  '3. 70 is larger than 50, so it goes to the right of 50.',
  '4. 20 and 40 go under 30. 60 and 80 go under 70 by the same comparisons.',
  '',
  '## Searching for 60',
  'Start at the root 50. Since 60 > 50, move right to 70. Since 60 < 70, move left and find 60. Only three nodes were visited.',
  '',
  '## Time Complexity',
  'Search, insertion and deletion take O(log n) time in a balanced tree and O(n) in the worst case, when the tree becomes a skewed chain.',
  '',
  '## Conclusion',
  'A BST keeps data ordered, which makes searching, insertion and deletion fast on average.',
].join('\n');
