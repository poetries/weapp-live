import { rPutLiveActivity, rGetLiveActivity,rGetImSign } from "../../netapi/live/index";

const indexState = {
  erroractions: { refresh: true, back: true, index: true },
};

export default {

  namespace: "pages/pusher",

  state: indexState,

  effects: {
    // 主请求
    *rMain({ payload, callback }, { call, put, select }) {
      const response = yield call(rGetLiveActivity, payload);

      if (response.code !== 0) {
        yield put({ type: "save", payload: { error: response } });
        return;
      }
      
      yield put({ type: "save", payload: { mainData: response.data } });
      
      callback && callback(response.data);
    },
    // 开始/结束直播 
    *rPut({ payload, success, fail }, { call, put, select }) {
      const response = yield call(rPutLiveActivity, payload);
      
      if (response.code !== 0) { fail && fail(); return; }
      
      success && success(response.data);
    },
    *rGetImSign({ payload,callback }, { call, put, select }) {
      const response = yield call(rGetImSign, payload);
      callback && callback(response.data);
    },
  },

  reducers: {
    clean() {
      return indexState;
    },
    save(state, { payload }) {
      return {
        ...state,
        ...payload,
      };
    },
  },
};
