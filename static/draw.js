function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    throw `Could not compile WebGL program. \n\n${info}`;
  }
  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error(`Could not compile WebGL program. \n\n${info}`);
  }

  return program;
}

function resizeCanvasToDisplaySize(canvas) {
  const displayWidth  = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  const needResize = canvas.width  !== displayWidth ||
                     canvas.height !== displayHeight;

  if (needResize) {
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
  }

  return needResize;
}

function draw(canvas, uniformList, fragmentShaderString) {
  resizeCanvasToDisplaySize(canvas);

  const gl = canvas.getContext("webgl2");
  const vs = `#version 300 es
    in vec4 a_position;

    void main() {
      gl_Position = a_position;
    }
  `;

  const program = createProgram(
    gl,
    createShader(gl, gl.VERTEX_SHADER, vs),
    createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderString)
  );
  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  const uniforms = uniformList.concat([
    { n: 2, t: "f", name: "u_resolution", get: () => { return [ gl.canvas.width, gl.canvas.height ]; } },
    { n: 1, t: "f", name: "u_time", get: () => { return [ time ]; } },
    { n: 2, t: "f", name: "u_mouse", get: () => { return [ mouseX, mouseY ]; } },
  ]);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(
    [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  let mouseX = 0.5;
  let mouseY = 0.5;

  let time;

  addEventListener("mousemove", (e) => {
    mouseX = (e.screenX / gl.canvas.width) - 0.5;
    mouseY = (e.screenY / gl.canvas.height) - 0.5;
  });

  const render = (t) => {
    time = t * 0.001;
    resizeCanvasToDisplaySize(gl.canvas);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    uniforms.forEach((u) => {
      gl[`uniform${u.n}${u.t}${u.v ? "v" : ""}`].bind(gl, gl.getUniformLocation(program, u.name)).apply(gl, u.get());
    });

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);

}

