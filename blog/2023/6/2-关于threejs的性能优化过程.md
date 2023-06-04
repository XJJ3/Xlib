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

因为用 `PlaneGeometry` 去创建一个面是在代码上是显得更方便，但是默认情况下平面的法线向量是指向正Z轴方向的，也就是平面垂直于屏幕。如果你想改变平面的朝向，可以通过旋转平面的方式来实现，有些繁琐。不仅如此，还有其他方面也能说明`BufferGeometry` 似乎更合适：
- 性能更优：`BufferGeometry`使用底层的缓冲区对象（buffer）来存储几何数据，这样可以更高效地传递数据给GPU进行渲染
- `BufferGeometry`在内存中占用的空间更小
- BufferGeometry提供了更多的属性和方法来对几何体进行自定义和操作。可以直接修改缓冲区中的顶点坐标、法线、UV坐标等信息，或者添加额外的自定义属性。这使得你可以更灵活地控制几何体的外观和行为。

:::

下面贴出一段比较核心的内容：



### 减少渲染线程压力



## 数据压缩优化

### 数据整型压缩

### 数据结构优化

### LZ4压缩

1、遍历数据表

2、给线程减压

3、