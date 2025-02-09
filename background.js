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
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
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

const canvas = document.querySelector("#background");
canvas.setAttribute("width", window.innerWidth);
canvas.setAttribute("height", window.innerHeight);
resizeCanvasToDisplaySize(canvas);

const gl = canvas.getContext("webgl2");
const vs = `#version 300 es
  in vec4 a_position;

  void main() {
    gl_Position = a_position;
  }
`;

const fs = `#version 300 es
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;

  out vec4 outColor;

  // void main() {
  //   vec2 uv = vec2(gl_FragCoord.x - u_resolution.x / 2.0, (u_resolution.y - gl_FragCoord.y) - u_resolution.y / 2.0) / u_resolution.xx;
  //   vec2 uv_repeated = fract(uv * 8.0) - vec2(0.5);
  //   float radius = 0.3;
  //   float a = smoothstep(radius + 0.01, radius - 0.01, length(uv_repeated));
  //   vec4 color = vec4(0.8 + sin(u_time * 1.2 + 25.0 * (length(uv))) * 0.4, 0, 0.5, 1.0);
  //   outColor = color * a + vec4(0.0, 0.0, 0.0, 1.0) * (1.0 - a);
  // }


  float circle(float radius, vec2 p) {
    float t = u_time * 0.5;
    // float r = radius * (0.1 + tan(0.4 * t) * tan(0.4 * (t + 0.0)));
    // float r = (radius * (1.0 + sin(t * 2.0) * sin(t * 5.0)) * 0.5);
    float r = radius * (1.0 + sin(t) + 0.02 * sin(100.0 * (1.0 + 0.1 * sin(t)) * t));
    return length(p) - r;
  }

  void main() {
    vec2 uv = (vec2(gl_FragCoord.x, (u_resolution.y - gl_FragCoord.y)) / u_resolution.xx) - vec2(0.5, 0.25);
    float t = 1.0 * u_time + length(uv) * 100.0;
    vec4 color = vec4(0.3 + 0.05 * sin(t), 0.6 + 0.1 * sin(t * 3.0), 0.7 + 0.12 * sin(t * 7.0), 1.0);

    float d;
    vec4 c = vec4(0.0);
    int octaves = 2 + int(10.0 * (1.0 - cos(u_time * 0.08)));
    for (int i = 0; i < octaves; i++) {
        d = abs(circle(0.1, fract(pow(2.0, float(i)) * uv) - 0.5));
        c += color * 0.001 / smoothstep(0.05, 6.0, pow(d, 0.45));
    }
    outColor = c;
  }
`;

var vertexShader = createShader(gl, gl.VERTEX_SHADER, vs);
var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fs);
var program = createProgram(gl, vertexShader, fragmentShader);
const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
const timeLocation = gl.getUniformLocation(program, "u_time");
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,  // first triangle
   1, -1,
  -1,  1,
  -1,  1,  // second triangle
   1, -1,
   1,  1,
]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(positionAttributeLocation);
gl.vertexAttribPointer(
    positionAttributeLocation,
    2,          // 2 components per iteration
    gl.FLOAT,   // the data is 32bit floats
    false,      // don't normalize the data
    0,          // 0 = move forward size * sizeof(type) each iteration to get the next position
    0,          // start at the beginning of the buffer
);

function render(time) {
  time *= 0.001;

  canvas.setAttribute("width", window.innerWidth);
  canvas.setAttribute("height", window.innerHeight);
  resizeCanvasToDisplaySize(gl.canvas);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(timeLocation, time);

  // draw 2 triangles
  gl.drawArrays(
      gl.TRIANGLES,
      0,     // offset
      6,     // num vertices to process
  );

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
