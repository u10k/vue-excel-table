export default {
  methods: {
    selectionChange(arg) {
      const { type, rowIndex } = arg;
      const { states } = this.store;
      const selection = this.store.states.showData.filter((item, index) => states.dataStatusList[index].checked);
      this.$emit('selection-change', selection);
      if (rowIndex) {
        const row = this.store.states.showData[rowIndex];
        this.$emit('selection-select', row);
      }
      if (type === 'Current') {
        this.$emit('selection-current-page', selection.length !== 0);
      } else if (type === 'All') {
        this.$emit('selection-all-page', selection.length !== 0);
      }
      const checkedAll = states.dataStatusList.every((item) => item.checked);
      if (checkedAll) {
        this.$refs.theader.checkedCurrent = true;
        this.$refs.fixedTheader.checkedCurrent = true;
        if (type === 'All') {
          this.$refs.theader.checkedAll = true;
          this.$refs.fixedTheader.checkedAll = true;
        }
      } else {
        this.$refs.theader.checkedCurrent = false;
        this.$refs.theader.checkedAll = false;
        this.$refs.fixedTheader.checkedCurrent = false;
        this.$refs.fixedTheader.checkedAll = false;
      }
    },
  },
};
