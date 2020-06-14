/* 开源 */
import { interval } from "../../miniprogram_npm/rxjs/index";
/* 工具 */
import { iosTime, secondsToReadable } from "../../utilities/util.js";
/* 框架 */
import { connect } from "../../libs/dva-giga/connect.js";
/* 数据 */
import model from "./model.js";

import { IMAGE_SERVICE } from "../../constants/backend";

/* IM核心库 */
const webim = require("../../libs/wx-sdk/webim_wx.js");

/* IM操作方法封装 */
const webimhandler = require("../../libs/wx-sdk/webim_handler.js");

// 计时
const numbers = interval(1000);

// 初始数据
function initData() {
  const callback = (res) => {
    // 推流上下文
    this.pusher = wx.createLivePusherContext("pusher");

    // 开播中直接倒计时
    if (res.liveStatus === 1) {
      this.counterLivedTime = numbers.subscribe((x) => {
        this.setData({ livedTime: secondsToReadable(Math.abs(res.secondToStart) + x) });
      });

    } else if (res.liveStatus === 0) {
      this.setData({ livedTime: '未开始' });
    }

    const callback2 = res => {
      let identifierNick = res.userName
      this.initIM({
        avChatRoomId: this.data.params.id, // 房间id
        userSig: res.sign, // 用户登录凭证
        sdkAppID: res.appId,
        identifier: res.userId,
        identifierNick
      });
      this.setData({identifierNick})
    }

    this.dispatch({
      type: `${model.namespace}/rGetImSign`,
      payload: {},
      callback: callback2
    });
  };

  this.dispatch({
    type: `${model.namespace}/rMain`,
    payload: {
      id: this.data.params.id
    },
    callback,
  });
}

Page(
  connect(model)({
    data: {
      params: {},
      livedTime: "", // 已直播时间
      pusherState: undefined, // 推流状态
      isInput: false,
      inputMarBot: false, //框聚焦时，让评论框距离底部的距离为50rpx
      IMAGE_SERVICE,
      msgScrollTop: 100, // 消息滚动高度
      msgs: [], // 消息列表
      isFans: false // 粉丝
    },

    onLoad(options) {
      this.setData({ params: options });

      initData.call(this);
    },

    onReady() {
      /*
      console.log("onReady");
      */
    },

    onShow() {
      /*
      console.log("onShow");
      */

      // 重新推流
      this.handlePusherResume();
    },

    onHide() {
      /*
      console.log("onHide");
      */
      // 暂停推流
      this.handlePusherPause();
    },

    onUnload() {
      // 取消订阅
      this.counterLivedTime && this.counterLivedTime.unsubscribe();

      // 退出大群
      // webimhandler.quitBigGroup();

      // 解散该群
      webimhandler.onDestroyGroup()
    },

    onPullDownRefresh() {},

    onReachBottom() {},

    onShareAppMessage: function (res) {
      /*
      if (res.from === 'button') {
        // 来自页面内转发按钮
        console.log(res.target)
      }
      */

      return {
        title: this.data.mainData.roomName,
        path: `/pages/player/index?id=${this.data.params.id}`,
        imageUrl: this.data.mainData.pageUrl,
      };
    },

    // ============================================================

    onReceiveProps(nextData) {
      // console.log('onReceiveProps', nextData);
      /*
      const data = {};
      if (nextData.a !== this.data.a) {
        data = { ...data, a: nextData.a };
      }
      if (nextData.b !== this.data.b) {
        data = { ...data, b: nextData.b };
      }
      this.setData(data);
      */
    },

    // ============================================================

    // 开始推流
    handlePusherStart() {
      const that = this;
      console.log("开始推流");

      const { mainData } = this.data;

      // 恢复推流
      if (mainData.liveStatus === 1) {
        this.setData({ pusherState: "start" });
        this.pusher.start();
        return;
      }

      // 开始推流
      this.dispatch({
        type: `${model.namespace}/rPut`,
        payload: {
          id: this.data.params.id,
          liveType: "start",
        },
        success: successStart,
        fail: failStart,
      });

      // 开始推流-失败
      function failStart() {
        wx.showToast({
          icon: "none",
          title: "直播有效期已过，请重新发起直播",
          duration: 2000,
        });
      }

      // 开始推流-成功
      function successStart(data) {
        // 开始直播
        that.setData({ pusherState: "start" });
        that.pusher.start();

        // 订阅计时器
        that.counterLivedTime = numbers.subscribe((x) => {
          that.setData({ livedTime: secondsToReadable(x + 1) });
        });
      }
    },

    // 暂停推流
    handlePusherPause() {
      console.log("暂停推流");
      if (this.data.pusherState === "start") {
        this.setData({ pusherState: "pause" });
        this.pusher.pause();
        console.log(this.pusher);
        // this.pusher.setMICVolume({ volume: 0.0 });
      }
    },

    // 重新推流
    handlePusherResume() {
      console.log("重新推流");
      if (this.data.pusherState === "pause") {
        this.setData({ pusherState: "start" });
        this.pusher.resume();
        // this.pusher.setMICVolume({ volume: 1.0 });
      }
    },

    // 刷新推流
    handlePusherRefresh() {
      console.log("刷新推流");
      if (this.data.pusherState === "start") {
        this.setData({ pusherState: "start" });

        const fail = () => {
          wx.showToast({
            icon: "none",
            title: "直播刷新失败，请退出重新进入",
            duration: 2000,
          });
        };

        this.pusher.stop({
          success: () => {
            this.pusher.start({ fail });
          },
          fail,
        });
      }
    },

    // 结束直播
    handlePusherOver() {

      const confirm = () => {
        // 停止播放
        this.pusher.stop();

        this.dispatch({
          type: `${model.namespace}/rPut`,
          payload: {
            id: this.data.params.id,
            liveType: "end",
          },
        });
        
        const endLiveTips = '直播结束啦^_^'
        webimhandler.onSendMsg(endLiveTips);

        wx.navigateBack();
      };

      const success = (res) => {
        if (res.confirm) {
          confirm();
        }
      };

      wx.showModal({
        title: "提示",
        content: "是否结束直播？",
        success,
      });
    },

    // 切换摄像头
    handleSwitch: function () {
      this.pusher.switchCamera({
        success: function (ret) {
          console.log("success", ret);
        },
        fail: function (err) {
          console.log("err", err);
        },
      });
    },

    // 推流状态
    handleStateChange(e) {
      const { code } = e.detail;
      console.log("live-pusher code:", code);

      if (code === -1307) {
        this.setData({ pusherState: "error" });
      }
    },
    // ===================================================
    // 评论输入框聚焦时，设置与底部的距离
    settingMbShow() {
      this.setData({
        inputMarBot: true,
      });
    },
    // 评论输入框失去聚焦时，设置与底部的距离（默认状态）
    settingMbNoShow(e) {
      this.setData({
        inputMarBot: false,
        isInput: false,
      });
    },
    showInput() {
      this.setData({
        isInput: true,
      });
    },
    /**
     * Im聊天相关
     *
     * 更多文档 docs/一分钟集成SDK(小程序)
     * IM SDK 小程序文档 https://imsdk-1252463788.file.myqcloud.com/IM_DOC/Web/SDK.html#createTextMessage
     * webimhandler 已经封装了常用的方法
     */
    onConfirm(e) {
      let content = e.detail.value;
      if (!content.replace(/^\s*|\s*$/g, "")) return;
      webimhandler.onSendMsg(content, ()=>{
        this.setData({
          msgContent: "",
          isInput: false,
        });
      });
    },
    // 接收聊天信息
    receiveMsgs(data) {
      var msgs = this.data.msgs || [];
      msgs.push(data);
      if (data.fromAccountNick == "@TIM#SYSTEM") {
        this.setData({
          // systemTips: data.content
          systemTips: `${this.data.identifierNick}进来了`,
        });
        setTimeout(() => {
          this.setData({
            systemTips: "",
          });
        }, 1300);
      }
      let newMsgs = msgs.filter((v) => v.fromAccountNick != "@TIM#SYSTEM");
      //最多展示100条信息
      if (newMsgs.length > 100) {
        newMsgs.splice(0, newMsgs.length - 100)
      }
      if(newMsgs.length>=6) {
        setTimeout(() => {
          this.setData({
            msgScrollTop: this.data.msgScrollTop * 100
          });
        }, 200);
      }
      this.setData({
        msgs: newMsgs,
      });
    },
    // 初始化聊天信息
    initIM(params){
      const that = this
      
      const identifier = params.identifier // userId 传入微信获取的用户id
      const identifierNick = params.identifierNick // 用户昵称
      const avChatRoomId = params.avChatRoomId // 聊天房间号
      const sdkAppID = params.sdkAppID 
      const userSig = params.userSig // 登录凭证
      
      /**
       * sdk文档 https://imsdk-1252463788.file.myqcloud.com/IM_DOC/Web/SDK.html#createTextMessage
       */
      webimhandler.init({
        accountMode: 0, //帐号模式，0-表示独立模式，1-表示托管模式(已停用，仅作为演示)
        accountType: 1, // 已废弃
        sdkAppID: sdkAppID,
        avChatRoomId: avChatRoomId, //默认房间群ID，群类型必须是直播聊天室（AVChatRoom）
        selType: webim.SESSION_TYPE.GROUP,
        selToID: avChatRoomId,
        selSess: null, //当前聊天会话
      });
      //当前用户身份
      var loginInfo = {
        sdkAppID, //用户所属应用id,必填
        appIDAt3rd: sdkAppID, //用户所属应用id，必填
        accountType: 1, // 已废弃
        identifier, //当前用户ID,必须是否字符串类型，选填
        identifierNick, //当前用户昵称，选填
        userSig, //当前用户身份凭证，必须是字符串类型，选填
      };
      //监听（多终端同步）群系统消息方法，方法都定义在demo_group_notice.js文件中
      const onGroupSystemNotifys = {
        "5": webimhandler.onDestoryGroupNotify, //群被解散(全员接收)
        "11": webimhandler.onRevokeGroupNotify, //群已被回收(全员接收)
        "255": webimhandler.onCustomGroupNotify, //用户自定义通知(默认全员接收)
      };
      //监听连接状态回调变化事件
      const onConnNotify = function (resp) {
        switch (resp.ErrorCode) {
          case webim.CONNECTION_STATUS.ON:
            //webim.Log.warn('连接状态正常...');
            break;
          case webim.CONNECTION_STATUS.OFF:
            webim.Log.warn("连接已断开，无法收到新消息，请检查下你的网络是否正常");
            break;
          default:
            webim.Log.error("未知连接状态,status=" + resp.ErrorCode);
            break;
        }
      };
      //监听事件
      const listeners = {
        onConnNotify: webimhandler.onConnNotify, //选填
        onBigGroupMsgNotify: function (msg) {
          webimhandler.onBigGroupMsgNotify(msg, function(msgs){
            that.receiveMsgs(msgs);
          });
        },
        //监听新消息(大群)事件，必填
        onMsgNotify: webimhandler.onMsgNotify, //监听新消息(私聊(包括普通消息和全员推送消息)，普通群(非直播聊天室)消息)事件，必填
        onGroupSystemNotifys: webimhandler.onGroupSystemNotifys, //监听（多终端同步）群系统消息事件，必填
        onGroupInfoChangeNotify: webimhandler.onGroupInfoChangeNotify, //监听群资料变化事件，选填
      };
      //其他对象，选填
      const options = {
        isAccessFormalEnv: true, //是否访问正式环境，默认访问正式，选填
        isLogOn: false, //是否开启控制台打印日志,默认开启，选填
      };
      webimhandler.sdkLogin(loginInfo, listeners, options, avChatRoomId);
    },
  })
);
