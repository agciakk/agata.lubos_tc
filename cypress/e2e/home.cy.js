describe('Podstawowy test ładowania strony', () => {
  it('powinien załadować stronę główną', () => {
    cy.visit('/') 

    cy.contains('To-Do', { timeout: 10000 }).should('be.visible')
  })
})