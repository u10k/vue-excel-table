export default {
  data() {
    return {
      theaderType: null,
    };
  },
  methods: {
    selectionChange(arg) {
      const { type, rowIndex } = arg;
      const { states } = this.store;
      const selection = this.store.states.showData.filter((item, index) => states.dataStatusList[index].checked);
      let row = null;
      this.$emit('selection-change', selection);
      if (rowIndex) {
        row = this.store.states.showData[rowIndex];
        this.$emit('selection-select', row);
      }
      if (type === 'Current') {
        if (selection.length !== 0) this.theaderType = 'Current';
        this.$emit('selection-current-page', selection.length !== 0);
      } else if (type === 'All') {
        if (selection.length !== 0) this.theaderType = 'All';
        this.$emit('selection-all-page', selection.length !== 0);
      }
      const checkedAll = states.dataStatusList.every((item) => item.checked);
      if (!checkedAll && row) {
        this.$refs.theader.checkedAll = false;
        this.$refs.fixedTheader.checkedAll = false;
        this.$refs.theader.checkedCurrent = false;
        this.$refs.fixedTheader.checkedCurrent = false;
      }
      if (checkedAll && row) {
        if (this.theaderType === 'All') {
          this.$refs.theader.checkedAll = true;
          this.$refs.fixedTheader.checkedAll = true;
        } else if (this.theaderType === 'Current') {
          this.$refs.theader.checkedCurrent = true;
          this.$refs.fixedTheader.checkedCurrent = true;
        }
      }
    },
  },
};
