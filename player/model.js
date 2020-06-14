import { rGetLiveGift, rPutUseLiveGift, rPutLiveActivity, rPostLiveActivityInfo, rGetLiveActivity, rGetLiveGiftMy,rGetImSign,rGetGiftInfo } from "../../netapi/live/index";
import { rPostProjectMcrm, rPostProjectVisit, rPostProjectLog } from "../../netapi/visit/index";

const indexState = {
  erroractions: { refresh: true, back: true, index: true },
};

export default {

  namespace: "pages/player",

  state: indexState,

  effects: {
    // 主请求
    *rMain({ payload, callback }, { call, put, select }) {

      const response = yield call(rGetLiveActivity, payload);

      if (response.code !== 0) {
        yield put({ type: "save", payload: { error: response } });
        return;
      }

      const responseGift = yield call(rGetLiveGiftMy);
      
      if (responseGift.code !== 0) {
        yield put({ type: "save", payload: { error: responseGift } });
        return;
      }
      
      yield put({ type: "save", payload: { error: 0, mainData: response.data, giftStatus: responseGift.data } });
      
      callback && callback(response.data);

      // 用户是否送过礼物
      const giftInfo = yield call(rGetGiftInfo, payload);
      if (giftInfo.code == 0) {
        yield put({ type: "save", payload: { isFans: !!giftInfo.data.projectName} });
      }

      // 埋点
      yield put({ type: "rPostLiveActivity", payload: { id: payload.id, type: 'view' } });
    },
    // 埋点：观看view/赞praise/跳转redirect
    *rPostLiveActivity({ payload, callback }, { call, put, select }) {
      yield call(rPostLiveActivityInfo, payload);
    },
    // 领火箭
    *rGetRocket({ payload,callback }, { call, put, select }) {
      const response = yield call(rGetLiveGift, payload);

      let icon = 'success';
      let title = '';

      if (response.code !== 0) {
        icon = 'none';
        title = response.message;
      } else {
        title = '领取成功';
        yield put({ type: "save", payload: { giftStatus: 1 } });
      }

      wx.showToast({
        icon,
        title,
        duration: 2000
      });
    },
    // 送火箭
    *rPutUseLiveGift({ payload,callback }, { call, put, select }) {
      const response = yield call(rPutUseLiveGift, payload);

      if (response.code !== 0) {
        wx.showToast({
          icon: 'none',
          title: response.message,
          duration: 2000
        });
      } else {
        yield put({ type: "save", payload: { giftStatus: 2 } });
      }

      callback && callback(response.data);
    },
    *rGetImSign({ payload,callback }, { call, put, select }) {
      const response = yield call(rGetImSign, payload);
      callback && callback(response.data);
    },
    *rPostProjectMcrm({ payload }, { call }) {
      yield call(rPostProjectMcrm, payload);
    },
    *rPostProjectVisit({ payload }, { call }) {
      yield call(rPostProjectVisit, payload);
    },
    *rPostProjectLog({ payload }, { call }) {
      yield call(rPostProjectLog, payload);
    },
  },

  reducers: {
    clean() {
      return indexState;
    },
    save(state, { payload }) {
      return {
        ...state,
        ...payload
      };
    }
  }
};
