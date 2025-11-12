// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1d1c1c');

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(12, 12, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const light = new THREE.DirectionalLight(0xffffff, 0.8);
light.position.set(10, 15, 10);
scene.add(light);

// Grid + ground
scene.add(new THREE.GridHelper(300, 300, '#dfdfdf', '#910c8a'));
const groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ visible: false }));
groundPlane.rotation.x = -Math.PI / 2;
scene.add(groundPlane);

// Collision detection
function checkCollision(newPos, brickSize, ignoreBrick) {
  for (const obj of scene.children.filter(o => o.type === 'Group' && o !== ignoreBrick)) {
    const otherPos = obj.position;
    const otherSize = obj.children[0].geometry.parameters;
    const overlapX = Math.abs(newPos.x - otherPos.x) < (brickSize.x + otherSize.width) / 2;
    const overlapZ = Math.abs(newPos.z - otherPos.z) < (brickSize.z + otherSize.depth) / 2;
    const overlapY = Math.abs(newPos.y - otherPos.y) < (brickSize.y + otherSize.height) / 2;
    if (overlapX && overlapZ && overlapY) return true;
  }
  return false;
}

// Brick creation
function createBrick(color, size, position) {
  const brickGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 }));
  brickGroup.add(body);

  // Studs
  const studGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 32);
  const studMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 });
  for (let i = 0; i < size.x; i++) {
    for (let j = 0; j < size.z; j++) {
      const stud = new THREE.Mesh(studGeo, studMat);
      stud.position.set(-size.x / 2 + 0.5 + i, size.y / 2 + 0.1, -size.z / 2 + 0.5 + j);
      brickGroup.add(stud);
    }
  }
  brickGroup.position.set(position.x, position.y, position.z);
  scene.add(brickGroup);
  return brickGroup;
}

// Selection + drag
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedBrick = null;

window.addEventListener('mousedown', e => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(scene.children.filter(o => o.type === 'Group'));
  if (hits.length) selectedBrick = hits[0].object;
});

window.addEventListener('mousemove', e => {
  if (!selectedBrick) return;
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(groundPlane)[0];
  if (hit) {
    const size = selectedBrick.children[0].geometry.parameters;
    const newPos = { x: Math.round(hit.point.x), y: size.height / 2, z: Math.round(hit.point.z) };
    if (!checkCollision(newPos, size, selectedBrick)) {
      selectedBrick.position.set(newPos.x, newPos.y, newPos.z);
    }
  }
});

// Add brick button with collision prevention
document.getElementById('addBrick').onclick = () => {
  const color = parseInt(document.getElementById('brickColour').value.replace('#', '0x'));
  const size = {
    x: parseInt(document.getElementById('brickWidth').value),
    y: parseInt(document.getElementById('brickHeight').value),
    z: parseInt(document.getElementById('brickDepth').value)
  };

  // Default position
  let position = { x: 0, y: size.y / 2, z: 0 };

  // If occupied, find nearest free spot
  if (checkCollision(position, size, null)) {
    let offset = 1;
    let found = false;
    while (!found && offset < 150) {
      const tryPosX = { x: offset, y: size.y / 2, z: 0 };
      const tryPosZ = { x: 0, y: size.y / 2, z: offset };
      if (!checkCollision(tryPosX, size, null)) {
        position = tryPosX;
        found = true;
      } else if (!checkCollision(tryPosZ, size, null)) {
        position = tryPosZ;
        found = true;
      }
      offset++;
    }
    if (!found) {
      document.getElementById('status').textContent = 'oh no, no space available for new brick.';
      return;
    } else {
      document.getElementById('status').textContent = '';
    }
  }

  createBrick(color, size, position);
};

// Random brick generation
function getRandomColour() {
  return Math.floor(Math.random() * 16777215); // random hex colour
}

function getRandomSize() {
  return {
    x: Math.floor(Math.random() * 4) + 1, // width 1-4
    y: Math.floor(Math.random() * 3) + 1, // height 1-3
    z: Math.floor(Math.random() * 4) + 1  // depth 1-4
  };
}

function getRandomPosition(size) {
  return {
    x: Math.floor(Math.random() * 20) - 10, // random X within grid
    y: size.y / 2,
    z: Math.floor(Math.random() * 20) - 10  // random Z within grid
  };
}

// Add random brick button logic
document.getElementById('addRandomBrick').onclick = () => {
  const color = getRandomColour();
  const size = getRandomSize();
  let position = getRandomPosition(size);

  // Collision prevention
  let attempts = 0;
  while (checkCollision(position, size, null) && attempts < 150) {
    position = getRandomPosition(size);
    attempts++;
  }

  if (attempts >= 150) {
    console.warn('cannot place another random brick without overlap.');
    return;
  }

  createBrick(color, size, position);
};

// Camera reset button
document.getElementById('resetCamera').onclick = () => {
  camera.position.set(12, 12, 12);
  controls.target.set(0, 0, 0);
  controls.update();
};

// Keyboard camera controls
const moveSpeed = 0.08; // Adjust for faster/slower movement
const keysPressed = {};

document.addEventListener('keydown', (event) => {
  keysPressed[event.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (event) => {
  keysPressed[event.key.toLowerCase()] = false;
});

function updateCameraMovement() {
  const camera = controls.object;

  if (keysPressed['arrowup'] || keysPressed['w']) {
    camera.position.z -= moveSpeed;
  }
  if (keysPressed['arrowdown'] || keysPressed['s']) {
    camera.position.z += moveSpeed;
  }
  if (keysPressed['arrowleft'] || keysPressed['a']) {
    camera.position.x -= moveSpeed;
  }
  if (keysPressed['arrowright'] || keysPressed['d']) {
    camera.position.x += moveSpeed;
  }
  if (keysPressed['q']) {
    camera.position.y += moveSpeed;
  }
  if (keysPressed['e']) {
    camera.position.y -= moveSpeed;
  }
  if (keysPressed['r']) {
    controls.reset();
  }

  controls.update();
  requestAnimationFrame(updateCameraMovement);
}

// Start the loop
updateCameraMovement();

// Render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});