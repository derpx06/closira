def default_employee_permissions() -> dict:
    return {
        'viewTickets': True,
        'updateTickets': True,
        'viewOwnProfile': True,
        'manageTeamRoles': False,
        'manageTeamMembers': False,
        'manageWorkspaceSettings': False,
    }
