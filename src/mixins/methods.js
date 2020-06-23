export default {
  methods: {
    getData() {
      return this.data;
    },
    setData(data) {
      this.data = data;
      this.$nextTick(() => {
        this.initData();
        this.store.handleFilters();
      });
    },
    getChangeData() {
      return this.store.states.changeData;
    },
    getErrorRows() {
      const { states } = this.store;
      const errorRowsIndex = states.dataStatusList.map((item, index) => {
        if (item.errors.length > 0) {
          return index;
        }
        return null;
      });
      const errorRows = this.data.map((d, index) => {
        if (errorRowsIndex.includes(index)) {
          return {
            data: d,
            index,
          };
        }
        return null;
      }).filter((i) => i);
      return errorRows;
    },
    addItem(item, type = 'push') {
      const { states } = this.store;
      states.addRowType = type;
      if (type === 'push') {
        this.data.push(item);
        states.dataStatusList.push({
          checked: false,
          errors: [],
        });
      } else if (type === 'unshift') {
        this.data.unshift(item);
        states.dataStatusList.unshift({
          checked: false,
          errors: [],
        });
      }
    },
    removeItems(key, values) {
      const { states } = this.store;
      if (key && values instanceof Array) {
        values.forEach((value) => {
          const dIndex = this.data.findIndex((d) => d[key] === value);
          states.dataStatusList.splice(dIndex, 1);
          this.data.splice(dIndex, 1);
        });
      }
    },
  },
};
