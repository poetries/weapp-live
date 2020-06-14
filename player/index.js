/* 开源 */
import { interval } from "../../miniprogram_npm/rxjs/index";
/* 工具 */
import { syncVarIterator, iosTime, secondsToReadable } from "../../utilities/util.js";
import { handlePageParams, handleUserKey } from "../../utilities/framework.js";
import { numberify } from "../../utilities/base.js";
import { getUserSettingStorage } from "../../utilities/storage.js";
/* 框架 */
import { connect } from "../../libs/dva-giga/connect.js";
/* 数据 */
import model from "./model.js";

import { IMAGE_SERVICE } from "../../constants/backend";

// 计时
const numbers = interval(1000);

/* IM核心库 */
const webim = require("../../libs/wx-sdk/webim_wx.js");

/* IM操作方法封装 */
const webimhandler = require("../../libs/wx-sdk/webim_handler.js");

Page(
  connect(model)({

    data: {
      params: {},
      livedTime: "--", // 已直播时间
      count: 0, // 点赞数累加
      modalVisible: false, // 礼物弹出层
      rocketVisible: false, // 火箭运行状态
      playerState: undefined, // 拉流状态
      isInput: false,
      inputMarBot: false, //框聚焦时，让评论框距离底部的距离为50rpx
      IMAGE_SERVICE,
      msgScrollTop: 100, // 消息滚动高度
      msgs: [], // 消息列表
    },

    onLoad(options) {
      this.pageparams = handlePageParams(options);
      
      this.setData({ params: options });

      this.initData();
    },

    onReady() {},

    onShow() {},

    onHide() {},

    onUnload() {
      // 取消订阅
      this.counterLivedTime && this.counterLivedTime.unsubscribe();

      // 退出大群
      webimhandler.quitBigGroup();
    },

    onPullDownRefresh() {},

    onReachBottom() {},

    onShareAppMessage(res) {
      /*
      if (res.from === 'button') {
        // 来自页面内转发按钮
        console.log(res.target)
      }
      */

      return {
        title: this.data.mainData.roomName,
        path: `/pages/player/index?id=${this.data.params.id}&inviterId=${handleUserKey('userId')}`,
        imageUrl: this.data.mainData.pageUrl,
      };
    },

    // ============================================================

    onReceiveProps(nextData) {},

    // ============================================================

    initData() {
      const callback = (res) => {
        // 拉流上下文
        this.player = wx.createLivePlayerContext("player");

        // 开播中直接倒计时
        if (res.liveStatus === 1) {
          this.counterLivedTime = numbers.subscribe((x) => {
            this.setData({ livedTime: secondsToReadable(Math.abs(res.secondToStart) + x) });
          });

        } else if (res.liveStatus === 0) {
          this.setData({ livedTime: '未开始，请稍后进入直播间' });
        }

        // 项目围观
        this.handleProjectLog(res);
        // 围观
        this.handleVisit(res);
        // 判客
        this.handleMcrm(res);

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
          id: this.data.params.id,
        },
        callback,
      });
    },

    // ============================================================

    // 项目围观
    handleProjectLog(res) {
      if (Boolean(res.projectId) === false) { return; }

      const user = getUserSettingStorage('user');
      const sessonKeyEncrypt = syncVarIterator.getter(user, 'sessionKey');
      const wxName = syncVarIterator.getter(user, 'wxName');
      const wxHeadPortrait = syncVarIterator.getter(user, 'wxHeadPortrait');

      if (Boolean(sessonKeyEncrypt) === false) { return; }
      if (Boolean(wxName) === false) { return; }
      if (Boolean(wxHeadPortrait) === false) { return; }

      this.dispatch({
        type: `${model.namespace}/rPostProjectLog`,
        payload: {
          id: res.projectId,
          sessonKeyEncrypt,
          wxName,
          wxHeadPortrait,
        }
      });
    },

    // 围观
    handleVisit(res) {
      this.dispatch({
        type: `${model.namespace}/rPostProjectVisit`,
        payload: {
          projectId: res.projectId,
          shareUserId: numberify(this.pageparams.inviterId),
        }
      });
    },

    // 判客
    handleMcrm(res) {
      this.dispatch({
        type: `${model.namespace}/rPostProjectMcrm`,
        payload: {
          projectId: res.projectId,
          inviterId: numberify(this.pageparams.inviterId),
        },
      });
    },

    // 跳转到项目
    goProject() {
      wx.navigateTo({
        url: `/areas/mobile/Project/Detail/Index?id=${this.data.mainData.projectId}`,
      });

      // 埋点
      this.dispatch({
        type: `${model.namespace}/rPostLiveActivity`,
        payload: {
          id: this.data.params.id,
          type: "redirect",
        },
      });
    },

    // 点击喜欢
    onLikeTap() {
      this.setData({
        count: this.data.count + 1,
      });

      // 前端控制点赞请求一次
      if (this.data.count > 1) {
        return;
      }

      // 埋点
      this.dispatch({
        type: `${model.namespace}/rPostLiveActivity`,
        payload: {
          id: this.data.params.id,
          type: "praise",
        },
      });
    },

    // 领火箭
    binRocket() {
      this.dispatch({
        type: `${model.namespace}/rGetRocket`,
      });
    },

    // 开始礼物
    onGiftTap() {
      // this.onRocketTap();
      if (this.data.giftStatus === 1) {
        this.setData({ modalVisible: true });
        return;
      }

      let title = "";

      if (this.data.giftStatus === 0) {
        title = "请先领取火箭";
      } else if (this.data.giftStatus === 2) {
        title = "礼物已送完";
      }

      wx.showToast({
        icon: "none",
        title,
        duration: 2000,
      });
    },

    // 取消送礼
    bindcancel() {
      this.setData({ modalVisible: false });
    },

    // 确定送礼
    bindConfirm() {
      const callback = () => {
        this.onRocketTap();
      };

      const confirm = () => {
        this.dispatch({
          type: `${model.namespace}/rPutUseLiveGift`,
          payload: {
            liveId: this.data.mainData.id,
          },
          callback,
        });
      };

      const success = (res) => {
        if (res.confirm) {
          this.setData({ modalVisible: false });
          confirm();
        }
      };

      wx.showModal({
        title: "提示",
        content: "是否确定打赏？打赏后，您将成为项目粉丝",
        success,
      });
    },

    // 火箭特效
    onRocketTap() {
      this.setData({ rocketVisible: true });

      let animation = wx.createAnimation({
        //动画持续时间，单位ms，默认值 400
        duration: 2000,
        /**
         * http://cubic-bezier.com/#0,0,.58,1
         *  linear  动画一直较为均匀
         *  ease    从匀速到加速在到匀速
         *  ease-in 缓慢到匀速
         *  ease-in-out 从缓慢到匀速再到缓慢
         *
         *  http://www.tuicool.com/articles/neqMVr
         *  step-start 动画一开始就跳到 100% 直到动画持续时间结束 一闪而过
         *  step-end   保持 0% 的样式直到动画持续时间结束        一闪而过
         */
        timingFunction: "linear",
        transformOrigin: "center center 0",
        //延迟多长时间开始
        delay: 200,
      });

      animation.translate(0, -1325).opacity(1).step();

      // 输出动画
      this.setData({
        ani: animation.export(),
        modalVisible: false,
      });

      // 每次回到初始状态的时间太久, 添加多一个动画实例
      let animation2 = wx.createAnimation({
        duration: 0,
        timingFunction: "linear",
        transformOrigin: "center center 0",
      });

      // 回到初始状态，否则多次点击操作动画只能执行一次
      const reset = () => {
        animation2.translate(0, 0).opacity(0).step();
        this.setData({
          ani: animation2.export(),
          rocketVisible: false,
        });
      };

      setTimeout(reset, 4000);

      webimhandler.onSendMsg(`送出火箭*1 🚀`);
    },

    // 刷新拉流
    handlePlayerRefresh() {
      console.log("刷新拉流");
      if (this.data.playerStatus === "error") {
        const fail = () => {
          wx.showToast({
            icon: "none",
            title: "直播刷新失败，请退出重新进入",
            duration: 2000,
          });
        };

        this.player.stop({
          success: () => {
            this.player.play({ fail });
            this.setData({ playerStatus: "play" });
          },
          fail,
        });
      }
    },

    // 错误
    handleError(e) {
      console.log(e);
    },

    // 网络状态
    handleNetStatus(e) {
      console.log(e);
    },

    // 拉流
    statechange(e) {
      console.log("live-player code:", e.detail.code);

      const { code } = e.detail;

      if (code === -2301) {
        this.setData({ playerStatus: "error" });
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
          isInput: false
        });
      });
    },
    // 接收聊天信息
    receiveMsgs(data) {
      let msgs = this.data.msgs || [];
      let endLiveTips = '直播结束啦^_^'
   
      msgs.push(data);
      if(data.content === endLiveTips) {
        this.setData({endLiveTips,playerStatus:'stop'});
        this.player.stop();
      }
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
