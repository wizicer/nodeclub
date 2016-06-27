Nodeclub
=

## 介绍

[Nodeclub] 是使用 **Node.js** 和 **MongoDB** 开发的社区系统，界面优雅，功能丰富，小巧迅速，
已在Node.js 中文技术社区 [CNode(http://cnodejs.org)](http://cnodejs.org) 得到应用，但你完全可以用它搭建自己的社区。

原始的[Nodeclub]在源代码级别植入了太多的定制功能和广告，故很难被他人直接使用和定制。
为此，需要重写大部分代码，使其支持主题系统和插件系统，这个会开另外一个项目，并取一个新名字。
不过，现在手上有一个微信公众号的项目，故暂时继续在这个repo上工作，如果恰巧你需要使用论坛的方式来管理微信公众号，说不定你可以试试看。
我们先说好哈，虽然系统已经上线，也欢迎大家扫码进来凑人头，但现在这个repo还在繁重的开发中，稳定性等问题尚无法保证。

为了未来能使通用论坛支持主题和插件系统，故本repo会不断在完成功能的基础上，向那个架构上靠。

## 安装部署

~~不保证 Windows 系统的兼容性~~

因为我的环境是windows的，所以这个fork会保证windows下的兼容性的，为此，移除了一些在windows平台下比较麻烦的组件。

```
1. install `node.js` `mongodb`
2. run mongod
3. `$ make install` 安装 Nodeclub 的依赖包
4. `$ make test` 确保各项服务都正常
5. `$ node app.js`
6. visit `localhost:3000`
7. done!
```

## 贡献

欢迎提PR，但是由于架构尚未确定，也许不少挺好的建议在当前阶段会被拒掉。并不是提PR不好，只是我这里还需要些时间准备接待大家。

扫码试试看？
![](https://raw.githubusercontent.com/wizicer/nodeclub/master/qrcode_for_gh_b0da88d529fb_258.jpg)

## License

MIT

[Nodeclub]: https://github.com/cnodejs/nodeclub
