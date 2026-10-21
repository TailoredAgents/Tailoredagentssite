import UIKit

final class WorkspaceController: UITabBarController {
    private var screens: [AppTab: WebScreenController] = [:]

    override func viewDidLoad() {
        super.viewDidLoad()
        viewControllers = AppTab.allCases.map { tab in
            let screen = WebScreenController(tab: tab)
            screen.openTab = { [weak self] tab, request in self?.open(tab, request: request) }
            screens[tab] = screen
            let navigation = UINavigationController(rootViewController: screen)
            navigation.tabBarItem = UITabBarItem(title: tab.title, image: UIImage(systemName: tab.symbol), tag: tab.rawValue)
            return navigation
        }
    }

    private func open(_ tab: AppTab, request: URLRequest) {
        selectedIndex = tab.rawValue
        screens[tab]?.open(request)
    }
}
