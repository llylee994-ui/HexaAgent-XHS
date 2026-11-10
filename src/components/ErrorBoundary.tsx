import { Component, type ErrorInfo, type ReactNode } from 'react'
import { PageFrame } from './PageFrame'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
}

/**
 * 顶层错误边界：任何渲染期或 effect 期的异常都在这里收口，显示可理解的重试界面。
 * 没有它时 React 会卸载整棵树，容器里看到的是整页空白——审核会直接判成功能缺陷。
 * 注意它接不住事件处理函数里的异常，那些由各自的 try/catch 负责。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('界面异常：', error, info.componentStack)
  }

  private retry = () => {
    this.setState({ failed: false })
  }

  render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children
    }
    return (
      <PageFrame title="出错了">
        <section className="page">
          <p className="hint hint--warning" role="alert">
            页面遇到异常，当前操作没能完成。已保存的卦例不受影响。
          </p>
          <button type="button" className="btn btn--primary" onClick={this.retry}>
            重试
          </button>
        </section>
      </PageFrame>
    )
  }
}
