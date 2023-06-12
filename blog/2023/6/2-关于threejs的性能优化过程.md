---
slug: threejs-optimize
title: 基于threejs点云图的性能优化过程
authors: xujunjie
tags: [threejs, worker]
---

最近几天在攻克一个性能问题，服务端以每秒十几赫兹（每秒接收十几次）的大数据，数据的大小可能在 60 多 KB 左右，然后要不断去解析数据、计算数据，最后用 threejs 来绘制出体素图。先看看大概的前端展示效果：
![](/blogImg/2023-6-2/example.jpg)
由于保密原因，真实效果不贴图展示，主要就是服务端通过一些硬件手段发送了 2 万个左右的点信息，然后前端将点描绘成类似我的世界这样的体素图用来展示周边环境的情况，真实场景是不算更新的动态点，此处仅仅只展示一帧静态体素图。

<!--truncate-->

## threejs 渲染优化

仔细看上面的展示图，发现那些无非就是一个个不同颜色的方格，threejs 实现一个方格还是比较简单，上面的体素图无非就是创建指定数量的方格放置在指定的坐标位置，于是一开始我就是简单去创建方格，然后根据服务端传输过来的数据进行定位渲染，服务端的数据结构也比较粗暴，类似这样：
``` js
{
  stamp: 1684829000,
  ...,
  // 全部立方体点的x,y,z坐标
  data: [
    0,0,0, // 第1个点的x,y,z
    0,0,1, // 第2个点的x,y,z
    0,0,2, // 第3个点的x,y,z
    0,0,3, // 第4个点的x,y,z
    0,1,0, // 第5个点的x,y,z
    ...
  ],
  ...
}
```
遍历`data`，每三个获取一个点的x，y，z坐标，依次去定位每个点的位置，代码如下：
``` js
// 创建红色的材质
var material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

function createBox(position: THREE.Vector3) {
  // 创建立方体的几何体
  var geometry = new THREE.BoxGeometry(1, 1, 1);
  // 创建立方体并将几何体和材质添加到其中
  var cube = new THREE.Mesh(geometry, material);
  cube.position.copy(position);
  return cube;
}

// 生成体素图
function genVoxelMap() {
  for(let i = 0; i < data.length; i++) {
    scene.add(createBox(new THREE.Vector3(data[i], data[++i] , data[++i])));
  }
}

genVoxelMap();
```

然后可以根据y坐标的高低来给每个方块设置不同的材质颜色，这个细节都不在样例代码中体现了。到这里就可以按照服务端传输的每个点坐标位置去渲染体素图，但是有个很致命的问题，当点的数量达到一万个点以上时，页面的拖动就会明显感觉到卡顿，这还是我在Mac（8核，32G内存）上的效果，如果到了手机上效果会更差，而且这还只是渲染一次静态的体素图，真实场景中每秒要处理十几帧数据，可想这会是什么样体验。
:::tip

可以使用THREE自带的`Stats`来监察THREE的渲染性能情况：
``` js
import Stats from 'three/examples/jsm/libs/stats.module';

const stats = Stats();
document.body.appendChild(stats.dom);
```
:::


### 减少重复面

当两个以及两个以上的方格挨在一起的时候，就会有一些面是重合贴在一起，那么这些面其实是看不见的，而用`BoxGeometry`去渲染一个立方体，不管怎么样都会把每个面都计算渲染一次，这样就会增加渲染压力，所以第一个优化点就是先尽量减少一些看不见却又被实际渲染的面。

我们可以改用直接用 `BufferGeometry` 去记录每个面的四个对角点坐标，遍历 `data`，判断每个点的哪些面需要渲染，哪些年不需要渲染。具体步骤如下：

1. 创建一个记录数据的map，遍历`data`，将每个点的的x，y，z坐标点作为key值，记录到map中，类似 `{'x,y,z': 1}`
2. 遍历map的key，根据每个点的坐标，计算出前后左右上下6个方向上的点位置，再组合成对应的key去map内查询时候存在相邻的点
3. 根据是否有对应方向是否有相邻点来判断每个面是否有重合，重合则不需要渲染，不重合则需要根据点的x，y，z去计算面的四个顶点位置，然后保存到提前声明好的数组`positions`
4. 在记录`positions`的同时也记录每个面的法线量`normal`和顶点索引`indices`以及需要不同高度的每个点的纹理`uv`，
5. 最后使用 `BufferGeometry` 对象来设置前面记录好的 `positions` 、`indices` 、`normal` 、`uv`

:::info

补充一个点，这里的x，y，z坐标在记录的时候只取整数，很多点的坐标都是浮点数，所以在遍历的时候最后将x，y，z都乘以10，录入map的时候尽量都取整，最后将渲染好的整体体素图对象再按照比例去缩小10倍，

:::

:::tip

可能有人问为什么不用 `PlaneGeometry` 去画面，这样创建一个面似乎更方便。

因为用 `PlaneGeometry` 去创建一个面是在代码上是显得更方便，但是默认情况下平面的法线向量是指向正Z轴方向的，也就是平面垂直于屏幕。如果你想改变平面的朝向，需要通过旋转平面的方式来实现，有些繁琐。不仅如此，还有其他方面也能说明`BufferGeometry` 似乎更合适：
- 性能更优：`BufferGeometry`使用底层的缓冲区对象（buffer）来存储几何数据，这样可以更高效地传递数据给GPU进行渲染
- `BufferGeometry`在内存中占用的空间更小
- BufferGeometry提供了更多的属性和方法来对几何体进行自定义和操作。可以直接修改缓冲区中的顶点坐标、法线、UV坐标等信息，或者添加额外的自定义属性。这使得你可以更灵活地控制几何体的外观和行为。

:::

核心代码：
``` js
// 6个面的方向和顶点相对位置
const faces = [
  {
    // left
    dir: [-1, 0, 0],
    corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]],
  },
  {
    // right
    dir: [1, 0, 0],
    corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]],
  },

  {
    // back
    dir: [0, -1, 0],
    corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]],
  },
  {
    // front
    dir: [0, 1, 0],
    corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]],
  },

  {
    // bottom
    dir: [0, 0, -1],
    corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]],
  },
  {
    // top
    dir: [0, 0, 1],
    corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],],
  },
];

const map = new Map<string, number>();
for (let i = 0; i < data.length; i++) {
  map.set(`${data[i]},${data[++i]},${data[++i]},`, 1);
}

const positions = [];
const normals = [];
const indices = [];
for (var [key] of map) {
  const [x, y, z] = key.split(",").map((n) => Number(n));

  for (const { dir, corners } of faces) {

    // 根据不同的面判断对应方向是否存在相邻的点
    const neighbor = map.get(`${x+dir[0]},${y+dir[1]},${z+dir[2]}`);

    if (!neighbor) {
      const ndx = positions.length / 3;
      for (const pos of corners) {
        positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
        normals.push(...dir);
      }
      indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
    }
  }
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
geometry.setIndex(indices);
const mesh = new THREE.Mesh(geometry, material); // 体素图对象
```

### 减少渲染线程压力
上面提到减少重复面来提高渲染的压力，但是如果计算的数据量够大，渲染频率够高，仅仅只是依靠减少重复面来达到高性能渲染还是不够的。

这里先提一点，JavaScript是一种单线程编程语言，这是它的一个重要特点。这意味着JavaScript引擎在执行JavaScript代码时只有一个主线程，按照代码的顺序逐行执行。这与其他一些编程语言（如Java或C++）不同，这些语言可以使用多个线程同时执行代码。恰恰因为这个单线程的特性，每一次渲染之前都需要计算大量数据，需要消耗很多时间，如果数据量够大，每一次遍历很可能都需要几十毫秒或者几百毫秒甚至更多，那么每秒能够渲染的帧数就非常有限。

所以为了减少主线程的资源占用，可以采用多线程的方式（很多人会问，js也能多线程吗，当然可以！！）。我们用`Web Worker`来实现js的多线程，不是很了解的可以看[MDN web docs 文档](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Using_web_workers)。

创建一个文件`point.worker.ts`：

``` js
const ctx: Worker = self as any;
ctx.addEventListener('message', (res) => {

  // 获取数据源
  const data = res.data;

  const map = new Map<string, number>();
  for (let i = 0; i < data.length; i++) {
    map.set(`${data[i]},${data[++i]},${data[++i]},`, 1);
  }

  const positions = [];
  const normals = [];
  const indices = [];
  for (var [key] of map) {
    const [x, y, z] = key.split(",").map((n) => Number(n));

    for (const { dir, corners } of faces) {

      // 根据不同的面判断对应方向是否存在相邻的点
      const neighbor = map.get(`${x+dir[0]},${y+dir[1]},${z+dir[2]}`);

      if (!neighbor) {
        const ndx = positions.length / 3;
        for (const pos of corners) {
          positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
          normals.push(...dir);
        }
        indices.push(ndx, ndx + 1, ndx + 2, ndx + 2, ndx + 1, ndx + 3);
      }
    }
  }

  ctx.postMessage({
    positionFloat32: new Float32Array(positions),
    normalsFloat32: new Float32Array(normals),
    indices
  });
}, false);

// 监听错误事件
ctx.addEventListener('error', () => {
  console.log('error');
});

export default ctx;
```

主线程代码：

``` js
const worker = new Worker(new URL('point.worker.ts', import.meta.url), { type: 'module' });

worker.postMessage(data); // 发送数据到worker线程

worker.onmessage = (e) => {
  const {positionFloat32, normalsFloat32, indices} = e.data;

  // 注意：拿到解析好的数据后怎么渲染按照实际代码逻辑渲染
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positionFloat32, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normalsFloat32, 3));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material); // 体素图对象
};
```
到这里，整体的前端渲染已经有了明显的优化效果体现，按照一秒渲染10帧左右，每一帧大概一万到两万个点可以很好渲染在页面上并且不会卡顿。

## 数据压缩优化

上面描述了两种在前端的优化方案，确实能很优化不少渲染效果，但是优化不仅仅只是在客户端体验，毕竟数据的来源是在生产端（也就是提供数据的服务端），所以生产端也需要有一些对应的优化方案，**优化传输效率**。

### 数据整型压缩
在threejs的三维世界里，每一个物体都是有对应的世界坐标x，y，z，而且这三个坐标系数都是浮点数，并不是整形数据。对于计算机，浮点数的计算过程比整数要复杂得多，并且浮点数的存储空间也比整数要大，所以尽可能地减少浮点数的计算和传输在我们这种高频率、大数据量的需求中是非常必要的。

在threejs三维世界中，假设有一个方块A坐标是`{x: 0.1323, y: 1.8783, z: 3.5677}`，并且方块大小是1，然后新建一个`group`容器，再创建一个方块B坐标为方块A坐标的10倍`{x: 1.323, y: 18.783, z: 35.677}`，大小也是方块A的10倍，接着将方块B放在容器`group`中，最后将容器缩小10倍，会发现方块A和方块B在三维世界里是几乎完全重合的：
```js
// 创建红色的材质
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
function createBox(position: THREE.Vector3, size?: number) {
  const boxSize = size || 1;
  // 创建立方体的几何体
  const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
  // 创建立方体并将几何体和材质添加到其中
  const cube = new THREE.Mesh(geometry, material);
  cube.position.copy(position);
  return cube;
}

const boxA = createBox(new THREE.Vector3(0.1323, 1.8783, 3.5677));
scene.add(boxA);

const group = new THREE.Group();
group.position.set(0,0,0);
const boxB = createBox(new THREE.Vector3(1.323, 18.783, 35.677), 10);
group.add(boxB);
group.scale.set(0.1,0.1,0.1);
scene.add(group);
```

按照上面的思路，只要每个方块的数据在服务端发送之前，将每个方块的坐标系数都做乘10处理，然后再取整，小数部分就不需要了，因为在渲染的时候相邻方块是贴在一起的，尽量不将方块重合。

这里再注意一个点，最好是传输正整数，也就是在遍历处理的时候记录下来最小负数值，然后将对应的x，y，z都加上最小值来归一化，接着为了尽量节省资源，在存储每一个数据尽量选用合适的存储类型，如果扫描的点范围不会特别大，基本在正负127以内，归一化之后就是0到255，那么我们就用`UInt8Array`来存储数据，如果不够用也可以使用`UInt16Array`。

:::tip

当需要在文本协议中传输二进制数据时，直接传输二进制数据可能导致数据损坏或解释错误，通过使用 `Base64` 编码，可以将二进制数据转换为纯文本格式，使其可以安全地传输，并确保在不同系统之间的可互操作性，即使传输的数据经过 `Base64` 编码会导致**数据体积增大约 33%**，但是为了数据的安全准确传输还是很有必要的。

:::

### 数据结构优化

优化之路不断进阶，总是会出现更大的数据来考验传输压力、客户端设备的渲染性能！！！

由于服务端只是一台性能较差的设备，上面部署了很多服务，CPU紧张，所以在传输这个体素图数据的时候传输压力还是蛮大的，为了再次缩减传输数据大小，只能再想办法。

如果每次传输的体素图是一堆立方体的点，并且每一帧体素图的空间大小范围比较固定，那服务端如果直接根据扫描得到点来绘制一张数据表，用来表示一个长宽高为固定值的容器中，每个单位空间中是否有存在立方体，就用0和1表示。

等等，看到0和1很容易想到二进制位，那将绘制出来的表按照每8位合成一个字节，那岂不是完美！每8位0和1组成二进制的数是0到255，对应一个`UInt8Array`存储大小。

我们来算一笔账吧，如果现在的体素图空间大概是长宽高为64x64x30（x轴最多扫描到64个方块，y轴最多扫描到64个方块，z轴最后扫描到30个方块），那一共最多可以扫描到 122880 个方块，假如每次实际能扫描的点位30000个。
- 按照原来的存储结构，每个点有x，y，z，三个坐标系数，每个坐标系数用一个`UInt8Array`，那就一共需要 30000 x 3 = 90000 个`UInt8Array`存储空间
- 新的存储结构，容器一共能容下122880个方块，每个方块都是用0和1表示，每8个方块组成一个字节，那一共需要 122880 / 8 = 15360 个`UInt8Array`存储空间

这笔账是不是很划算。当然，如果扫描范围不变，而每次扫描的点非常少，这种方案的效率是没有原来的好，但是我们最终还是要考虑到实际的场景。

这种结构传到前端也很方便使用，前端需要遍历`data`一遍即可，并且大多数都是0比较多，如果是0可以直接跳过。

```js

const data = new Uint8Array(15360); // 假设是服务端传送的数据

// 计算对应位置的二进制位数据
const calBitForIndex = (decimal: number, i: number) => {
  return (decimal >> (7 - i)) & 1;
}

for (let i = 0; i < data.byteLength; i++) {
      if (data[i] > 0) {
        // 如果不是0  则表示该字节中对应的8个二进制位有存在1即表示存在方格
        const byte = data[i];
        // 遍历这个字节的8个二进制位上的数
        for (let j = 0; j < 8; j++) {
          const bit = calBitForIndex(byte, j);
          if (bit) {
            // 如果是1 则表示存在方格
            const voxelIndex = i * 8 + j;

            const z = Math.floor(voxelIndex / (cellSize_X * cellSize_Y));
            const xy = voxelIndex % (cellSize_X * cellSize_Y);
            const y = Math.floor(xy / cellSize_X);
            const x = xy % cellSize_X;

            for (const { dir, corners } of faces) {
              // ...  根据不同的面判断对应方向是否存在相邻的点 记录每个点的信息
            }
          }
        }
      }
    }
```


### LZ4压缩

LZ4 是一种非常快速的压缩和解压缩算法，在时间和空间上都能得到很不错压缩效果，用LZ4解压缩也能减少很多传输压力！！！

:::info

[官方介绍：](http://lz4.github.io/lz4/)

** LZ4 is lossless compression algorithm, providing compression speed > 500 MB/s per core (>0.15 Bytes/cycle). It features an extremely fast decoder, with speed in multiple GB/s per core (~1 Byte/cycle). A high compression derivative, called LZ4_HC, is available, trading customizable CPU time for compression ratio. LZ4 library is provided as open source software using a BSD license. **

:::

LZ4源码是C语言写的，但是也有各方大佬根据源码做了其他语言版本的扩展，它们符合 LZ4 和框架规范，因此可以互操作。这里提一下JavaScript版本的LZ4：[浏览器版本](https://github.com/Benzinga/lz4js)（虽然是浏览器版本，但是是 CommonJS 模块） 和 [Nodejs版本](https://github.com/pierrec/node-lz4)，本文比较推荐前端开发的朋友们，不管是用在浏览器端还是Node端，直接阅读Nodejs版本的官方样例和源码，然后从中摘取核心的压缩和解压缩代码，不需要引入整个库。

:::tip
源码搬运工：[点这里](https://github.com/pierrec/node-lz4/blob/master/build/lz4.js)
:::


## 终极优化：WASM

前端工程师最头疼的一件事情就是需要对不同型号的设备尽量做到雨露均沾！！！通过以上优化后信心满满在作者的iphone 11上跑，想看看效果，最后发现手机有延迟的现象，解释一下，这里的延迟不是网络延迟，是随着接收的帧数据越来越多的时候，画面会变卡，并且帧数据出现堆积现象。

**<font color='#e53935'>首先为什么会出现堆积现象呢？</font>**因为我们是用的 `Web Worker` 来解析和计算帧数据，而 `Web Worker` 有一个特性，它使用消息队列模式进行通信，但它本身并不会阻塞主线程，消息队列确保了消息的顺序执行，并且在主线程中的任务队列为空时，才会处理 Worker 发送的消息。也就是说，当主线程向 Worker 发送消息时，该消息会被添加到 Worker 的消息队列中，然后 Worker 在合适的时机处理这些消息，如果主线程和 Worker 之间频繁地进行大量的消息传递，可能会导致消息队列中不断堆积帧数据，计算处理速度跟不上数据的堆积速度，导致明明是2分钟前得到帧数据，在2分钟后才慢慢渲染出来。

同样的，当 Worker 向主线程发送消息时，这些消息也会被添加到主线程的消息队列中，所以主线程也有可能会堆积了很多已经被处理完的数据，如果堆积了很多没来得及送给 threejs 去渲染的帧数据，就会导致页面卡顿。

为了解决堆积问题，那我们可以先简单做一个处理：在 Worker 接受处理的入口处加一个阀门来控制进出。每次送一帧数据给到 Worker 之后，加一个标记，当 Worker 处理完了返回结果之后再去除标记，如果标记未去除的时候有得到新的帧数据则不往 Worker 去送，直接忽略。这样可能会丢失一些帧数据，但是没办法，毕竟我们每次都希望渲染最新的数据嘛。

``` js
// 主线程
let workerActive = 0; // 1是激活  0是未激活

if(workerActive === 0) {
  worker.postMessage(data.data);
  workerActive = 1;
}
worker.onmessage = (e) => {
  workerActive = 0;
  // 进行渲染
};
```

