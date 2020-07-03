<template>
  <div id="app">
    <hgroup :class="s.title">
      <h2>从左侧勾选定制你的数据表格</h2>
    </hgroup>
    <div :class="s.main">
      <div :class="s.features_wrapper">
        <div :class="s.features_title">
          <span>特征</span>
          <button :class="s.github_link" @click="linkGithub"></button>
        </div>
        <ul :class="s.features_list">
          <li
            v-for="(item, index) in features"
            :key="index">
            <label>{{ item.label }}</label>
            <el-checkbox v-model="item.checked" @change="item.handleChange"></el-checkbox>
          </li>
        </ul>
      </div>
      <div :class="s.excel-table_wrapper">
        <excel-table
        ref="excelTable"
        :columns="columns"
        v-model="data"
        :maxHeight="maxHeight"
        :disabled="disabled"
        :showIcon="showIcon"
        :cellStyle="cellStyle"
        :cellClassName="cellClassName"
        @selection-change="selectionChange"
        @select="select"
        :rowHeight="28" />
      </div>
    </div>
  </div>
</template>

<script>
// import axios from 'axios';
import Mock from 'mockjs';
import { checkbox } from 'element-ui';
import ExcelTable from '../src/components/Table.vue';
// import ExcelTable from '../dist/vue-excel-table.min';
// import '../dist/vue-excel-table.min.css';

export default {
  name: 'App',
  components: {
    ExcelTable,
    'el-checkbox': checkbox,
  },
  data() {
    return {
      features: [
        {
          label: '显示数据类型icon',
          checked: true,
          handleChange: (checked) => {
            this.showIcon = checked;
          },
        },
        {
          label: '显示行多选',
          checked: true,
          handleChange: (checked) => {
            if (checked) {
              this.columns.unshift({
                type: 'selection',
                width: 40,
                fixed: true,
              });
            } else {
              this.columns.shift();
            }
          },
        },
        {
          label: '固定列（序号、姓名）',
          checked: true,
          handleChange: (checked) => {
            this.columns.forEach((col) => {
              if (['sid', 'name'].includes(col.key)) {
                col.fixed = checked;
              }
            });
          },
        },
        {
          label: '启用筛选与过滤（序号、姓名、日期）',
          checked: false,
          handleChange: (checked) => {
            this.columns.forEach((col) => {
              if (['sid', 'name', 'date'].includes(col.key)) {
                this.$set(col, 'action', checked);
              }
            });
          },
        },
        {
          label: '禁止整表操作',
          checked: false,
          handleChange: (checked) => {
            this.disabled = checked;
          },
        },
        {
          label: '禁止序号操作',
          checked: false,
          handleChange: (checked) => {
            this.columns.some((col) => {
              if (col.key === 'sid') {
                this.$set(col, 'disabled', checked);
                return true;
              }
              return false;
            });
          },
        },
        {
          label: '自定义单元格样式',
          checked: false,
          handleChange: (checked) => {
            if (checked) {
              this.cellStyle = ({ rowIndex, columnIndex }) => {
                if (rowIndex % 2 === 1 && columnIndex % 2 === 0) {
                  return {
                    color: '#67C23A',
                  };
                }
              };
            } else {
              this.cellStyle = () => {};
            }
          },
        },
        {
          label: '自定义单元格类名',
          checked: false,
          handleChange: (checked) => {
            if (checked) {
              this.cellClassName = ({ rowIndex, columnIndex }) => {
                if (rowIndex % 2 === 0 && columnIndex % 2 === 1) {
                  return {
                    customChanged: true,
                  };
                }
              };
            } else {
              this.cellClassName = () => {};
            }
          },
        },
        {
          label: '新增一行',
          checked: false,
          handleChange: () => {
            const rowObj = {};
            this.columns.forEach((item) => {
              if (item.key) {
                rowObj[item.key] = '';
              }
            });
            this.$refs.excelTable.addItem(rowObj, 'unshift');
          },
        },
      ],
      columns: [],
      columnsData: [
        {
          type: 'selection',
          width: 40,
          fixed: true,
        },
        {
          title: '序号',
          key: 'sid',
          fixed: true,
          type: 'number',
          width: 100,
        },
        {
          title: '姓名',
          required: true,
          key: 'name',
          fixed: true,
          width: 120,
        },
        {
          title: '日期',
          key: 'date',
          type: 'date',
          width: 100,
        },
        {
          title: '工作岗位',
          key: 'email',
          width: 300,
          type: 'select',
          options: [
            {
              value: '选项1',
              label: 'Web前端开发',
            },
            {
              value: '选项2',
              label: 'Java开发',
            },
            {
              value: '选项3',
              label: 'Python开发',
            },
            {
              value: '选项4',
              label: 'Php开发',
            },
          ],
        },
        {
          title: '月份',
          key: 'month',
          type: 'month',
          width: 100,
        },
        {
          title: '地址',
          key: 'address',
          width: 200,
        },
        {
          title: '标题',
          key: 'title',
          width: 300,
        },
        {
          title: '内容',
          key: 'paragraph',
          width: 300,
        },
        {
          title: '链接',
          key: 'url',
          width: 200,
        },
        {
          title: 'ip',
          key: 'ip',
          width: 200,
          validate: (value) => {
            const pattern = /((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})(\.((2(5[0-5]|[0-4]\d))|[0-1]?\d{1,2})){3}/g;
            return pattern.test(value);
          },
        },
        {
          title: '总金额',
          key: 'sum',
          width: 200,
        },
        {
          title: 'ID',
          key: 'id',
          width: 200,
        },
        {
          title: '色值',
          key: 'color',
          width: 200,
        },
      ],
      data: [],
      showIcon: true,
      disabled: false,
      maxHeight: 800,
      cellStyle: () => {},
      cellClassName: () => {},
    };
  },
  watch: {
    data: {
      handler(list) {
        console.log(list);
      },
      immediate: true,
      deep: true,
    },
  },
  mounted() {
    this.getList();
    this.maxHeight = document.documentElement.clientHeight - 200;
  },
  methods: {
    getList() {
      this.columns = this.columnsData;
      const data = Mock.mock({
        // 属性 list 的值是一个数组，其中含有 1 到 3 个元素
        'list|100': [{
          // 属性 sid 是一个自增数，起始值为 1，每次增 1
          'sid|+1': 1,
          // 属性 userId 是一个5位的随机码
          'userId|5': '',
          // 属性 sex 是一个bool值
          'sex|1-2': true,
          // 属性 guid 是唯一机器码
          guid: '@guid',
          // 属性 id 是随机id
          id: '@id',
          // 属性 title 是一个随机长度的标题
          title: '@title()',
          // 属性 paragraph 是一个随机长度的段落
          paragraph: '@cparagraph',
          // 属性 image 是一个随机图片 参数分别为size, background, text
          image: "@image('200x100', '#4A7BF7', 'Hello')",
          // 属性 address 是一个随机地址
          address: '@county(true)',
          // 属性 date 是一个yyyy-MM-dd 的随机日期
          date: '@date("yyyy-MM-dd")',
          // 属性 date 是一个yyyy-MM-dd 的随机日期
          month: '',
          // 属性 time 是一个 size, background, text 的随机时间
          time: '@time("HH:mm:ss")',
          // 属性 url 是一个随机的url
          url: '@url',
          // 属性 email 是一个随机email
          email: '选项1',
          // 属性 ip 是一个随机ip
          ip: '@ip',
          sum: '@ip',
          // 属性 regexp 是一个正则表达式匹配到的值 如aA1
          regexp: /[a-z][A-Z][0-9]/,
          name: '@name()',
          color: '@rgba()',
        }],
      });
      this.$refs.excelTable.setData(data.list, null, 100);
      // axios.get('https://demo.kevinmint.com/1.json').then((res) => {
      //   this.columns = this.columnsData;
      //   this.$refs.excelTable.setData(res.data.list);
      // }).catch(() => {});
    },
    getErrorRows() {
      console.log(this.$refs.excelTable.getErrorRows());
    },
    getChangeData() {
      console.log(this.$refs.excelTable.getChangeData());
    },
    selectionChange(val) {
      console.log(val);
    },
    select(val, column, row) {
      console.log(val, column, row);
    },
    // cellStyle({ rowIndex, columnIndex }) {
    //   if (rowIndex === 1) {
    //     return {
    //       color: 'red',
    //     };
    //   }
    //   if (columnIndex === 5) {
    //     return {
    //       color: 'green',
    //     };
    //   }
    // },
    add() {
      const obj = {};
      obj.id = new Date().getTime();
      this.columns.forEach((item) => {
        if (item.key) {
          obj[item.key] = '';
        }
      });
      this.$refs.excelTable.addItem(obj);
    },
    remove() {
      this.$refs.excelTable.removeItems('sid', this.selection.map((s) => s.sid));
    },
    linkGithub() {
      // window.open('', '_blank');
    },
  },
};
</script>

<style lang="scss" module="s">
:global {
  html, body, #app {
    height: 100%;
  }
  .customChanged {
    background-color: rgba(247,181,0,0.1);
  }
}

.title {
  text-align: center;
  padding-top: 20px;
  h2 {
    font-size: 24px;
    margin-bottom: 6px;
  }
  h3 {
    font-size: 18px;
    font-weight: normal;
    a {
      color: #0366d6;
      cursor: pointer;
      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.main {
  display: flex;
  align-items: flex-start;
  padding: 20px;
  overflow: auto;
  height: calc(100% - 81px);
}

.features_wrapper {
  flex: none;
  width: 280px;
  margin-right: 30px;
}

.features_title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #363636;
  margin-bottom: 20px;
  span {
    font-size: 18px;
  }
}

.features_list {
  padding-left: 20px;
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    padding: 10px 2px;
    border-bottom: 1px solid #e3e3e3;
  }
}

.excel-table_wrapper {
  flex: auto;
  overflow-x: auto;
  height: 100%;
}

.github_link {
  display: inline-block;
  width: 24px;
  height: 24px;
  background-image: url('./github.jpg');
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  transition: all 0.3s;
  opacity: 0.7;
  cursor: pointer;
  &:hover {
    transform: rotate(360deg) scale(2);
    opacity: 1;
  }
}

.more {
  font-size: 32px;
  text-align: right;
}
</style>
