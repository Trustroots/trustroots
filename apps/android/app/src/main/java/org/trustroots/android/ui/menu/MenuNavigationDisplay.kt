package org.trustroots.android.ui.menu

import android.content.Context
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import org.trustroots.android.api.MemberSession
import org.trustroots.android.api.MobileApiClient
import org.trustroots.android.api.MobileMember
import org.trustroots.android.browser.BrowserRoute
import org.trustroots.android.browser.DefaultBrowserContent
import org.trustroots.android.ui.MenuBrowserDestination
import org.trustroots.android.ui.MenuBrowserVisit
import org.trustroots.android.ui.MenuPage
import org.trustroots.android.ui.MenuPageVisit
import org.trustroots.android.ui.common.LocalLeaveGuard
import org.trustroots.android.ui.common.SharedNavigationLinks
import org.trustroots.android.ui.contacts.ContactsScreen
import org.trustroots.android.ui.account.AccountSettingsScreen
import org.trustroots.android.ui.editprofile.EditProfileScreen
import org.trustroots.android.ui.hostoffer.HostOfferScreen
import org.trustroots.android.ui.profile.MemberProfileScreen

@Composable
internal fun MenuNavigationDisplay(
    initialVisitID: Long,
    session: MemberSession,
    api: MobileApiClient,
    onSessionInvalidated: () -> Unit,
    onMemberUpdated: (MobileMember) -> Unit,
    onSignedOut: () -> Unit,
    onCurrentUsageScreen: (Long, org.trustroots.android.analytics.UsageScreen?) -> Unit,
    isActiveTabVisit: Boolean,
    onResetAvailable: (Long, () -> Unit) -> Unit,
    browserContent: @Composable (BrowserRoute, () -> Unit, PaddingValues) -> Unit = DefaultBrowserContent,
    contentPadding: PaddingValues = PaddingValues.Zero,
    openFindPeople: () -> Unit,
    openCircles: () -> Unit,
    menuBackStack: NavBackStack<NavKey> = rememberNavBackStack(MenuPageVisit(MenuPage.Menu, initialVisitID)),
) {
    var nextVisitID by rememberSaveable(initialVisitID) { mutableLongStateOf(initialVisitID + 1L) }
    fun allocateVisitID(): Long = nextVisitID++
    val context = LocalContext.current
    val currentMenuRoute = menuBackStack.lastOrNull()
    val resetToMenuRoot: () -> Unit = remember(menuBackStack, initialVisitID) {
        {
            menuBackStack.clear()
            menuBackStack.add(MenuPageVisit(MenuPage.Menu, initialVisitID))
            Unit
        }
    }
    val leaveGuardState = LocalLeaveGuard.current
    val resetMenuFromNavigation: () -> Unit = {
        val reset = resetToMenuRoot
        leaveGuardState?.value?.invoke(reset) ?: reset()
    }
    SideEffect {
        onCurrentUsageScreen(
            initialVisitID,
            when (currentMenuRoute) {
                is MenuMemberProfileVisit -> org.trustroots.android.analytics.UsageScreen.Profile
                is MenuEditProfileVisit -> org.trustroots.android.analytics.UsageScreen.EditProfile
                is MenuPageVisit -> when (currentMenuRoute.page) {
                    MenuPage.Menu -> org.trustroots.android.analytics.UsageScreen.Menu
                    MenuPage.Profile -> org.trustroots.android.analytics.UsageScreen.Profile
                    MenuPage.EditProfile -> org.trustroots.android.analytics.UsageScreen.EditProfile
                    MenuPage.Contacts -> org.trustroots.android.analytics.UsageScreen.Contacts
                    MenuPage.Host -> org.trustroots.android.analytics.UsageScreen.Host
                    MenuPage.Account -> org.trustroots.android.analytics.UsageScreen.Account
                }
                else -> null
            },
        )
        if (isActiveTabVisit) onResetAvailable(initialVisitID, resetMenuFromNavigation)
    }
    val popRoute: () -> Unit = {
        if (menuBackStack.size > 1) menuBackStack.removeLastOrNull()
    }
    val popRouteFromNavigation: () -> Unit = {
        val leave = popRoute
        leaveGuardState?.value?.invoke(leave) ?: leave()
    }
    val pushPage: (MenuPage) -> Unit = { page ->
        menuBackStack.add(MenuPageVisit(page, allocateVisitID()))
    }
    val pushMemberProfile: (String) -> Unit = { username ->
        menuBackStack.add(MenuMemberProfileVisit(username, allocateVisitID()))
    }
    val pushBrowser: (MenuBrowserVisit) -> Unit = { route ->
        menuBackStack.add(route)
    }
    val decorators: List<NavEntryDecorator<NavKey>> = listOf(
        rememberSaveableStateHolderNavEntryDecorator(),
        rememberViewModelStoreNavEntryDecorator(),
    )
    NavDisplay(
        backStack = menuBackStack,
        onBack = popRouteFromNavigation,
        entryDecorators = decorators,
        entryProvider = entryProvider {
            entry<MenuPageVisit> { route ->
                when (route.page) {
                    MenuPage.Menu -> MenuScreen(
                        session = session,
                        openProfile = { pushPage(MenuPage.Profile) },
                        openEditProfile = { menuBackStack.add(MenuEditProfileVisit(session.member.username, allocateVisitID())) },
                        openHost = { pushPage(MenuPage.Host) },
                        openNostroots = {
                            pushBrowser(MenuBrowserVisit(MenuBrowserDestination.Nostroots, allocateVisitID()))
                        },
                        openContacts = { pushPage(MenuPage.Contacts) },
                        openFindPeople = openFindPeople,
                        openCircles = openCircles,
                        openAccount = { pushPage(MenuPage.Account) },
                        openBrowser = { link ->
                            pushBrowser(
                                MenuBrowserVisit(
                                    MenuBrowserDestination.SupportLink,
                                    allocateVisitID(),
                                    supportLinkID = link.id,
                                ),
                            )
                        },
                        contentPadding = contentPadding,
                    )
                    MenuPage.Profile -> MemberProfileScreen(
                        api = api,
                        session = session,
                        username = session.member.username,
                        onSessionInvalidated = onSessionInvalidated,
                        onBack = popRoute,
                        onOwnProfileSaved = { updated ->
                            onMemberUpdated(MobileMember(updated.username, updated.displayName))
                        },
                        contentPadding = contentPadding,
                        browserContent = browserContent,
                    )
                    MenuPage.EditProfile -> EditProfileScreen(
                        api = api,
                        session = session,
                        username = session.member.username,
                        onSessionInvalidated = onSessionInvalidated,
                        onCancel = popRoute,
                        onSaved = { updated ->
                            onMemberUpdated(MobileMember(updated.username, updated.displayName))
                            popRoute()
                        },
                        contentPadding = contentPadding,
                    )
                    MenuPage.Contacts -> ContactsScreen(
                        api = api,
                        session = session,
                        onSessionInvalidated = onSessionInvalidated,
                        onBack = popRouteFromNavigation,
                        onOpenProfile = pushMemberProfile,
                        contentPadding = contentPadding,
                    )
                    MenuPage.Host -> HostOfferScreen(
                        api = api,
                        session = session,
                        onSessionInvalidated = onSessionInvalidated,
                        onBack = popRoute,
                        contentPadding = contentPadding,
                    )
                    MenuPage.Account -> AccountSettingsScreen(
                        api = api,
                        session = session,
                        onSessionInvalidated = onSessionInvalidated,
                        onBack = popRoute,
                        contentPadding = contentPadding,
                        onResetPassword = {
                            pushBrowser(
                                MenuBrowserVisit(MenuBrowserDestination.ResetPassword, allocateVisitID()),
                            )
                        },
                        onSignedOut = onSignedOut,
                    )
                }
            }
            entry<MenuMemberProfileVisit> { route ->
                MemberProfileScreen(
                    api = api,
                    session = session,
                    username = route.username,
                    onSessionInvalidated = onSessionInvalidated,
                    onBack = popRouteFromNavigation,
                    contentPadding = contentPadding,
                    browserContent = browserContent,
                )
            }
            entry<MenuEditProfileVisit> { route ->
                EditProfileScreen(
                    api = api,
                    session = session,
                    username = route.username,
                    onSessionInvalidated = onSessionInvalidated,
                    onCancel = popRoute,
                    onSaved = { updated ->
                        onMemberUpdated(MobileMember(updated.username, updated.displayName))
                        popRoute()
                    },
                    contentPadding = contentPadding,
                )
            }
            entry<MenuBrowserVisit> { route ->
                val browserRoute = remember(route, session.cookieHeader, context) {
                    browserRouteFor(route, session.cookieHeader, context)
                }
                browserContent(browserRoute, popRoute, contentPadding)
            }
        },
    )
}

internal fun browserRouteFor(
    route: MenuBrowserVisit,
    sessionCookie: String?,
    context: Context,
): BrowserRoute {
    return when (route.destination) {
        MenuBrowserDestination.Nostroots -> BrowserRoute(
            title = context.getString(org.trustroots.android.R.string.screen_nostroots),
            url = "https://nos.trustroots.org/",
            sessionCookie = sessionCookie,
        )
        MenuBrowserDestination.ResetPassword -> BrowserRoute(
            title = context.getString(org.trustroots.android.R.string.screen_reset_password),
            url = "https://www.trustroots.org/password/forgot",
        )
        MenuBrowserDestination.SupportLink -> {
            val link = SharedNavigationLinks.INFO_AND_SUPPORT.firstOrNull { it.id == route.supportLinkID }
                ?: return BrowserRoute(
                    context.getString(org.trustroots.android.R.string.screen_info_and_support),
                    SharedNavigationLinks.SITE_URL,
                )
            BrowserRoute(title = context.getString(supportLinkLabelResource(link.id)), url = link.url)
        }
    }
}


internal fun supportLinkLabelResource(linkID: String): Int = when (linkID) {
    "about" -> org.trustroots.android.R.string.screen_menu_link_about
    "blog" -> org.trustroots.android.R.string.screen_menu_link_blog
    "contact" -> org.trustroots.android.R.string.screen_menu_link_contact
    "faq" -> org.trustroots.android.R.string.screen_menu_link_faq
    "foundation" -> org.trustroots.android.R.string.screen_menu_link_foundation
    "media" -> org.trustroots.android.R.string.screen_menu_link_media
    "wiki" -> org.trustroots.android.R.string.screen_menu_link_wiki
    "privacy" -> org.trustroots.android.R.string.screen_menu_link_privacy
    "rules" -> org.trustroots.android.R.string.screen_menu_link_rules
    "safety" -> org.trustroots.android.R.string.screen_menu_link_safety
    "statistics" -> org.trustroots.android.R.string.screen_menu_link_statistics
    else -> org.trustroots.android.R.string.screen_info_and_support
}
